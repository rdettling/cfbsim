from ..models import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.stats import game_stats

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

    return Response(
        {
            "info": InfoSerializer(info).data,
            "game": GamesSerializer(game).data,
            "top_players": top_players,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


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
            }
            categorized_game_log_strings["Rushing"].append(rush_game_log_dict)

        if "wr" in position.lower() or (
            "rb" in position.lower() and game_log.receiving_catches > 0
        ):
            recv_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.receiving_catches} catches, {game_log.receiving_yards} yards, {game_log.receiving_touchdowns} TDs",
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