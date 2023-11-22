from start.models import *
from start.util.players import ROSTER
from django.shortcuts import render


def schedule(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.teams.get(name=team_name)

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
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

    context = {
        "team": team,
        "teams": info.teams.order_by("name"),
        "schedule": schedule,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.order_by("confName"),
    }

    return render(request, "schedule.html", context)


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

    game_logs = player.game_logs.all()  # Query for the game logs

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

    # Calculate derived statistics
    if cumulative_stats["pass_attempts"] > 0:
        cumulative_stats["completion_percentage"] = round(
            (cumulative_stats["pass_completions"] / cumulative_stats["pass_attempts"])
            * 100,
            1,
        )
        cumulative_stats["adjusted_pass_yards_per_attempt"] = round(
            (
                cumulative_stats["pass_yards"]
                + (20 * cumulative_stats["pass_touchdowns"])
                - (45 * cumulative_stats["pass_interceptions"])
            )
            / cumulative_stats["pass_attempts"],
            1,
        )

        # Calculate Passer rating
        a = ((cumulative_stats["completion_percentage"] / 100) - 0.3) * 5
        b = (
            (cumulative_stats["pass_yards"] / cumulative_stats["pass_attempts"]) - 3
        ) * 0.25
        c = (
            cumulative_stats["pass_touchdowns"] / cumulative_stats["pass_attempts"]
        ) * 20
        d = 2.375 - (
            (cumulative_stats["pass_interceptions"] / cumulative_stats["pass_attempts"])
            * 25
        )

        cumulative_stats["passer_rating"] = round(((a + b + c + d) / 6) * 100, 1)
    else:
        cumulative_stats["completion_percentage"] = 0
        cumulative_stats["adjusted_pass_yards_per_attempt"] = 0
        cumulative_stats["passer_rating"] = 0

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

    context = {
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
