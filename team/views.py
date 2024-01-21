from start.models import *
from util.players import ROSTER
from django.shortcuts import render
from util.stats import *


def schedule(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.teams.get(name=team_name)

    year = request.GET.get("year")

    if year:
        games_as_teamA = team.games_as_teamA.filter(year=year)
        games_as_teamB = team.games_as_teamB.filter(year=year)
    else:
        games_as_teamA = team.games_as_teamA.filter(year=info.currentYear)
        games_as_teamB = team.games_as_teamB.filter(year=info.currentYear)

    schedule = list(games_as_teamA | games_as_teamB)
    schedule = sorted(schedule, key=lambda game: game.weekPlayed)

    for week in schedule:
        if week.teamA == team:
            opponent = week.teamB
            week.label = week.labelA
            week.moneyline = week.moneylineA
            week.spread = week.spreadA
            week.result = week.resultA
            if not week.overtime:
                week.score = f"{week.scoreA} - {week.scoreB}"
            else:
                if week.overtime == 1:
                    week.score = f"{week.scoreA} - {week.scoreB} OT"
                else:
                    week.score = f"{week.scoreA} - {week.scoreB} {week.overtime}OT"
        else:
            opponent = week.teamA
            week.label = week.labelB
            week.moneyline = week.moneylineB
            week.spread = week.spreadB
            week.result = week.resultB
            if not week.overtime:
                week.score = f"{week.scoreB} - {week.scoreA}"
            else:
                if week.overtime == 1:
                    week.score = f"{week.scoreB} - {week.scoreA} OT"
                else:
                    week.score = f"{week.scoreB} - {week.scoreA} {week.overtime}OT"
        week.opponent = opponent.name
        week.rating = opponent.rating
        week.ranking = opponent.ranking
        week.opponentRecord = f"{opponent.totalWins} - {opponent.totalLosses} ({opponent.confWins} - {opponent.confLosses})"

    years = []
    for i in range(info.currentYear, info.startYear - 1, -1):
        years.append(i)

    context = {
        "years": years,
        "team": team,
        "teams": info.teams.order_by("name"),
        "schedule": schedule,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.order_by("confName"),
    }

    return render(request, "schedule.html", context)


def history(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    teams = info.teams.all()
    team = teams.get(name=team_name)

    years = team.years.order_by("-year")

    context = {
        "years": years,
        "team": team,
        "teams": teams.order_by("name"),
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.order_by("confName"),
    }

    return render(request, "history.html", context)


def roster(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.teams.get(name=team_name)
    positions = list(ROSTER.keys())

    roster = []
    for position in positions:
        players = team.players.filter(pos=position).order_by("-starter", "-rating")
        roster.extend(players)

    context = {
        "team": team,
        "teams": info.teams.order_by("name"),
        "roster": roster,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.order_by("confName"),
        "positions": positions,
    }

    return render(request, "roster.html", context)


def player(request, team_name, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    player = Players.objects.get(id=id)
    team = player.team

    year = request.GET.get("year")
    if not year:
        game_logs = player.game_logs.filter(game__year=info.currentYear).order_by(
            "game__weekPlayed"
        )
    else:
        game_logs = player.game_logs.filter(game__year=year).order_by(
            "game__weekPlayed"
        )

    cumulative_stats = {
        "pass_yards": 0,
        "pass_attempts": 0,
        "pass_completions": 0,
        "pass_touchdowns": 0,
        "pass_interceptions": 0,
        "rush_yards": 0,
        "rush_attempts": 0,
        "rush_touchdowns": 0,
        "receiving_yards": 0,
        "receiving_catches": 0,
        "receiving_touchdowns": 0,
        "field_goals_made": 0,
        "field_goals_attempted": 0,
    }

    for game_log in game_logs:
        game = game_log.game
        if game.teamA == player.team:
            game_log.opponent = game_log.game.teamB.name
            game_log.rank = game.rankBTOG
            game_log.label = game.labelA
            if not game.overtime:
                game_log.result = f"{game.resultA} ({game.scoreA} - {game.scoreB})"
            else:
                if game.overtime == 1:
                    game_log.result = (
                        f"{game.resultA} ({game.scoreA} - {game.scoreB} OT)"
                    )
                else:
                    game_log.result = f"{game.resultA} ({game.scoreA} - {game.scoreB} {game.overtime}OT)"
        else:
            game_log.opponent = game.teamA.name
            game_log.rank = game.rankATOG
            game_log.label = game.labelB
            if not game_log.game.overtime:
                game_log.result = f"{game.resultB} ({game.scoreB} - {game.scoreA})"
            else:
                if game_log.game.overtime == 1:
                    game_log.result = (
                        f"{game.resultB} ({game.scoreB} - {game.scoreA} OT)"
                    )
                else:
                    game_log.result = f"{game.resultB} ({game.scoreB} - {game.scoreA} {game.overtime}OT)"

        for key in cumulative_stats.keys():
            cumulative_stats[key] += getattr(game_log, key, 0)

    cumulative_stats["completion_percentage"] = completion_percentage(
        cumulative_stats["pass_completions"], cumulative_stats["pass_attempts"]
    )
    cumulative_stats[
        "adjusted_pass_yards_per_attempt"
    ] = adjusted_pass_yards_per_attempt(
        cumulative_stats["pass_yards"],
        cumulative_stats["pass_touchdowns"],
        cumulative_stats["pass_interceptions"],
        cumulative_stats["pass_attempts"],
    )
    cumulative_stats["passer_rating"] = passer_rating(
        cumulative_stats["pass_completions"],
        cumulative_stats["pass_attempts"],
        cumulative_stats["pass_yards"],
        cumulative_stats["pass_touchdowns"],
        cumulative_stats["pass_interceptions"],
    )

    if cumulative_stats["rush_attempts"] > 0:
        cumulative_stats["rush_yards_per_attempt"] = round(
            cumulative_stats["rush_yards"] / cumulative_stats["rush_attempts"], 1
        )
    else:
        cumulative_stats["rush_yards_per_attempt"] = 0

    if cumulative_stats["receiving_catches"] > 0:
        cumulative_stats["yards_per_reception"] = (
            cumulative_stats["receiving_yards"] / cumulative_stats["receiving_catches"]
        )
    else:
        cumulative_stats["yards_per_reception"] = 0

    years = []
    current_year = info.currentYear
    if player.year == "fr":
        years.append(current_year)
    elif player.year == "so":
        years.extend([current_year, current_year - 1])
    elif player.year == "jr":
        years.extend([current_year, current_year - 1, current_year - 2])
    elif player.year == "sr":
        years.extend(
            [current_year, current_year - 1, current_year - 2, current_year - 3]
        )

    years = [year for year in years if info.startYear <= year <= current_year]

    context = {
        "years": years,
        "team": team,
        "player": player,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.order_by("confName"),
        "game_logs": game_logs,
        "cumulative_stats": cumulative_stats,
    }

    return render(request, "player.html", context)


def stats(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    teams = Teams.objects.filter(info=info).order_by("name")
    conferences = Conferences.objects.filter(info=info).order_by("confName")

    context = {
        "team": team,
        "teams": teams,
        "info": info,
        "conferences": conferences,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    return render(request, "stats.html", context)
