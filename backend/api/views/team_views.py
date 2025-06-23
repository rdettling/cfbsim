from ..models import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.stats import percentage, average, adjusted_pass_yards_per_attempt, passer_rating
from logic.util import get_schedule_game, get_player_info, get_position_stats, get_position_game_log
from logic.constants.player_constants import ROSTER


@api_view(["GET"])
def team_info(request):
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.teams.get(name=request.GET.get("team_name"))

    return Response(
        {
            "team": TeamsSerializer(team).data,
        }
    )

@api_view(["GET"])
def team_schedule(request, team_name):
    """API endpoint for team schedule data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.teams.get(name=team_name)
    year = request.GET.get("year")

    if year and int(year) != info.currentYear:
        games_as_teamA = team.games_as_teamA.filter(year=year)
        games_as_teamB = team.games_as_teamB.filter(year=year)

        historical = info.years.filter(year=year, team=team).first()
        if historical:
            team.rating = historical.rating
            team.ranking = historical.rank
            team.totalWins = historical.wins
            team.totalLosses = historical.losses
    else:
        games_as_teamA = team.games_as_teamA.filter(year=info.currentYear)
        games_as_teamB = team.games_as_teamB.filter(year=info.currentYear)

    schedule = sorted(
        list(games_as_teamA | games_as_teamB), key=lambda game: game.weekPlayed
    )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(team).data,
            "games": [get_schedule_game(team, game) for game in schedule],
            "years": list(range(info.currentYear, info.startYear - 1, -1)),
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "teams": TeamNameSerializer(
                info.teams.all().order_by("name"), many=True
            ).data,
        }
    )



@api_view(["GET"])
def roster(request, team_name):
    """API endpoint for team roster data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.teams.get(name=team_name)
    positions = list(ROSTER.keys())

    # Process roster data by position
    roster_data = []
    for position in positions:
        players = team.players.filter(pos=position).order_by("-starter", "-rating")
        for player in players:
            player_data = {
                "id": player.id,
                "first": player.first,
                "last": player.last,
                "pos": player.pos,
                "year": player.year,
                "rating": player.rating,
                "starter": player.starter,
            }
            roster_data.append(player_data)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(team).data,
            "roster": roster_data,
            "positions": positions,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "teams": TeamNameSerializer(
                info.teams.all().order_by("name"), many=True
            ).data,
        }
    )

@api_view(["GET"])
def player(request, id):
    """API endpoint for player data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    player = Players.objects.get(id=id)
    team = player.team

    # Determine available years based on player's year
    current_year = info.currentYear
    if player.year == "fr":
        years = [current_year]
    elif player.year == "so":
        years = [current_year, current_year - 1]
    elif player.year == "jr":
        years = [current_year, current_year - 1, current_year - 2]
    elif player.year == "sr":
        years = [current_year, current_year - 1, current_year - 2, current_year - 3]
    years = [year for year in years if info.startYear <= year <= current_year]

    # Get yearly cumulative stats
    yearly_cumulative_stats = {}
    for year in years:
        year_game_logs = player.game_logs.filter(game__year=year)

        year_stats = {
            "games": len(year_game_logs),
            "pass_yards": sum(gl.pass_yards or 0 for gl in year_game_logs),
            "pass_attempts": sum(gl.pass_attempts or 0 for gl in year_game_logs),
            "pass_completions": sum(gl.pass_completions or 0 for gl in year_game_logs),
            "pass_touchdowns": sum(gl.pass_touchdowns or 0 for gl in year_game_logs),
            "pass_interceptions": sum(
                gl.pass_interceptions or 0 for gl in year_game_logs
            ),
            "rush_yards": sum(gl.rush_yards or 0 for gl in year_game_logs),
            "rush_attempts": sum(gl.rush_attempts or 0 for gl in year_game_logs),
            "rush_touchdowns": sum(gl.rush_touchdowns or 0 for gl in year_game_logs),
            "receiving_yards": sum(gl.receiving_yards or 0 for gl in year_game_logs),
            "receiving_catches": sum(
                gl.receiving_catches or 0 for gl in year_game_logs
            ),
            "receiving_touchdowns": sum(
                gl.receiving_touchdowns or 0 for gl in year_game_logs
            ),
            "field_goals_made": sum(gl.field_goals_made or 0 for gl in year_game_logs),
            "field_goals_attempted": sum(
                gl.field_goals_attempted or 0 for gl in year_game_logs
            ),
        }

        # Add derived stats
        year_stats["class"], year_stats["rating"] = get_player_info(
            player, current_year, year
        )
        year_stats["completion_percentage"] = percentage(
            year_stats["pass_completions"], year_stats["pass_attempts"]
        )
        year_stats["adjusted_pass_yards_per_attempt"] = adjusted_pass_yards_per_attempt(
            year_stats["pass_yards"],
            year_stats["pass_touchdowns"],
            year_stats["pass_interceptions"],
            year_stats["pass_attempts"],
        )
        year_stats["passer_rating"] = passer_rating(
            year_stats["pass_completions"],
            year_stats["pass_attempts"],
            year_stats["pass_yards"],
            year_stats["pass_touchdowns"],
            year_stats["pass_interceptions"],
        )
        year_stats["yards_per_rush"] = average(
            year_stats["rush_yards"], year_stats["rush_attempts"]
        )
        year_stats["yards_per_rec"] = average(
            year_stats["receiving_yards"], year_stats["receiving_catches"]
        )
        year_stats["field_goal_percent"] = percentage(
            year_stats["field_goals_made"], year_stats["field_goals_attempted"]
        )

        # Filter stats based on position
        yearly_cumulative_stats[year] = get_position_stats(player.pos, year_stats)

    # Get game logs for selected year
    year = request.GET.get("year", str(info.currentYear))
    game_logs = []
    for gl in player.game_logs.filter(game__year=year).order_by("game__weekPlayed"):
        # Filter game log stats based on position
        filtered_game_log = get_position_game_log(
            player.pos, gl, get_schedule_game(team, gl.game)
        )
        game_logs.append(filtered_game_log)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "player": PlayersSerializer(player).data,
            "years": years,
            "team": TeamsSerializer(team).data,
            "yearly_cumulative_stats": yearly_cumulative_stats,
            "game_logs": game_logs,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def history(request, team_name):
    """API endpoint for team history data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.teams.get(name=team_name)

    # Get years data and process it
    years_data = []
    for year in team.years.order_by("-year"):
        years_data.append(
            {
                "year": year.year,
                "prestige": year.prestige,
                "rating": year.rating,
                "conference": year.conference,
                "wins": year.wins,
                "losses": year.losses,
                "rank": year.rank,
            }
        )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(team).data,
            "years": years_data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "teams": TeamNameSerializer(
                info.teams.all().order_by("name"), many=True
            ).data,
        }
    )

