from ..models import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.stats import game_stats, accumulate_team_stats
from django.db.models import Q

@api_view(["GET"])
def game(request, id):
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    game = info.games.get(id=id)

    if game.winner:
        return game_result(info, game)
    else:
        return game_preview(info, game)


def game_preview(info, game):
    """API endpoint for game preview data"""
    # Fetch top 5 starters for each team
    top_players_a = list(
        game.teamA.players.filter(starter=True).order_by("-rating")[:5]
    )
    top_players_b = list(
        game.teamB.players.filter(starter=True).order_by("-rating")[:5]
    )

    # Pad the shorter list with None values if necessary
    max_players = max(len(top_players_a), len(top_players_b))
    top_players_a += [None] * (max_players - len(top_players_a))
    top_players_b += [None] * (max_players - len(top_players_b))

    # Process player data
    top_players = [[], []]  # Two arrays: one for teamA, one for teamB
    for player_a in top_players_a:
        if player_a:
            top_players[0].append(
                {
                    "id": player_a.id,
                    "first": player_a.first,
                    "last": player_a.last,
                    "pos": player_a.pos,
                    "rating": player_a.rating,
                }
            )

    for player_b in top_players_b:
        if player_b:
            top_players[1].append(
                {
                    "id": player_b.id,
                    "first": player_b.first,
                    "last": player_b.last,
                    "pos": player_b.pos,
                    "rating": player_b.rating,
                }
            )

    # Calculate team stats and rankings
    team_stats_data = calculate_team_stats_with_rankings(info, game.teamA, game.teamB)
    
    # Get game data and add stats to team objects
    game_data = GamesSerializer(game).data
    game_data["teamA"].update(team_stats_data["team_a"])
    game_data["teamB"].update(team_stats_data["team_b"])

    return Response(
        {
            "info": InfoSerializer(info).data,
            "game": game_data,
            "top_players": top_players,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


def calculate_team_stats_with_rankings(info, team_a, team_b):
    """Calculate team stats and rankings for offensive/defensive yards per game and points per game"""
    all_games = info.games.filter(year=info.currentYear, winner__isnull=False)
    plays = info.plays.all()
    
    # Calculate stats for all teams
    all_team_stats = {}
    for team in info.teams.all():
        games = all_games.filter(Q(teamA=team) | Q(teamB=team))
        
        offense_stats = accumulate_team_stats(team, games, plays.filter(offense=team))
        defense_stats = accumulate_team_stats(team, games, plays.filter(defense=team))
        
        all_team_stats[team.id] = {
            'team': team,
            'offensive_ypg': offense_stats.get('yardspg', 0),
            'defensive_ypg': defense_stats.get('yardspg', 0),
            'points_per_game': offense_stats.get('ppg', 0)
        }
    
    # Sort teams by each stat to determine rankings
    # Offensive yards per game (higher is better)
    offensive_rankings = sorted(all_team_stats.values(), key=lambda x: x['offensive_ypg'], reverse=True)
    offensive_rank_map = {team_stat['team'].id: idx + 1 for idx, team_stat in enumerate(offensive_rankings)}
    
    # Defensive yards per game (lower is better)
    defensive_rankings = sorted(all_team_stats.values(), key=lambda x: x['defensive_ypg'])
    defensive_rank_map = {team_stat['team'].id: idx + 1 for idx, team_stat in enumerate(defensive_rankings)}
    
    # Points per game (higher is better)
    points_rankings = sorted(all_team_stats.values(), key=lambda x: x['points_per_game'], reverse=True)
    points_rank_map = {team_stat['team'].id: idx + 1 for idx, team_stat in enumerate(points_rankings)}
    
    # Get stats for both teams in the game
    team_a_stats = all_team_stats[team_a.id]
    team_b_stats = all_team_stats[team_b.id]
    
    return {
        'team_a': {
            'stats': {
                'offensive_ypg': {
                    'value': round(team_a_stats['offensive_ypg'], 1),
                    'rank': offensive_rank_map[team_a.id]
                },
                'defensive_ypg': {
                    'value': round(team_a_stats['defensive_ypg'], 1),
                    'rank': defensive_rank_map[team_a.id]
                },
                'points_per_game': {
                    'value': round(team_a_stats['points_per_game'], 1),
                    'rank': points_rank_map[team_a.id]
                }
            }
        },
        'team_b': {
            'stats': {
                'offensive_ypg': {
                    'value': round(team_b_stats['offensive_ypg'], 1),
                    'rank': offensive_rank_map[team_b.id]
                },
                'defensive_ypg': {
                    'value': round(team_b_stats['defensive_ypg'], 1),
                    'rank': defensive_rank_map[team_b.id]
                },
                'points_per_game': {
                    'value': round(team_b_stats['points_per_game'], 1),
                    'rank': points_rank_map[team_b.id]
                }
            }
        }
    }


def game_result(info, game):
    """API endpoint for game result data"""
    drives = game.drives.all()
    game_logs = game.game_logs.all()

    # Process game logs by category
    categorized_game_log_strings = {
        "Passing": [],
        "Rushing": [],
        "Receiving": [],
        "Kicking": [],
    }

    for game_log in game_logs:
        player = game_log.player
        position = player.pos
        team_name = player.team.name

        if "qb" in position.lower():
            qb_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - QB): {game_log.pass_completions}/{game_log.pass_attempts} for {game_log.pass_yards} yards, {game_log.pass_touchdowns} TDs, {game_log.pass_interceptions} INTs",
            }
            categorized_game_log_strings["Passing"].append(qb_game_log_dict)

        if "rb" in position.lower() or (
            "qb" in position.lower() and game_log.rush_attempts > 0
        ):
            rush_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.rush_attempts} carries, {game_log.rush_yards} yards, {game_log.rush_touchdowns} TDs",
                "yards": game_log.rush_yards,
            }
            categorized_game_log_strings["Rushing"].append(rush_game_log_dict)

        if "wr" in position.lower() or (
            "rb" in position.lower() and game_log.receiving_catches > 0
        ) or (
            "te" in position.lower() and game_log.receiving_catches > 0
        ):
            recv_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.receiving_catches} catches, {game_log.receiving_yards} yards, {game_log.receiving_touchdowns} TDs",
                "yards": game_log.receiving_yards,
            }
            categorized_game_log_strings["Receiving"].append(recv_game_log_dict)
        if "k" in position.lower():
            k_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - K): {game_log.field_goals_made}/{game_log.field_goals_attempted} FG",
            }
            categorized_game_log_strings["Kicking"].append(k_game_log_dict)

    # Process drives data
    drives_data = []
    for drive in drives:
        drives_data.append(
            {
                "offense": drive.offense.name,
                "result": drive.result,
                "points": drive.points,
                "scoreAAfter": drive.scoreAAfter,
                "scoreBAfter": drive.scoreBAfter,
            }
        )

    # Sort rushing and receiving game logs by yards (descending)
    categorized_game_log_strings["Rushing"].sort(key=lambda x: x["yards"], reverse=True)
    categorized_game_log_strings["Receiving"].sort(key=lambda x: x["yards"], reverse=True)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "game": GamesSerializer(game).data,
            "drives": drives_data,
            "stats": game_stats(game),
            "game_logs": categorized_game_log_strings,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    ) 