from start.models import *
from logic.players import ROSTER
from django.shortcuts import render
from logic.stats import *


def schedule(request, team_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.teams.get(name=team_name)

    year = request.GET.get("year")

    if year and int(year) != info.currentYear:
        games_as_teamA = team.games_as_teamA.filter(year=year)
        games_as_teamB = team.games_as_teamB.filter(year=year)

        a = info.years.filter(year=year, team=team).first()

        team.rating = a.rating
        team.ranking = a.rank

        team.totalWins = a.wins
        team.totalLosses = a.losses
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

    def get_player_info(player, current_year, year):
        year_diff = current_year - year
        if year_diff == 0:
            return player.year, player.rating
        elif year_diff == 1:
            if player.year == "sr":
                return "jr", player.rating_jr
            if player.year == "jr":
                return "so", player.rating_so
            if player.year == "so":
                return "fr", player.rating_fr
        elif year_diff == 2:
            if player.year == "sr":
                return "so", player.rating_so
            if player.year == "jr":
                return "fr", player.rating_fr
        elif year_diff == 3:
            return "fr", player.rating_fr

    all_year_game_logs = player.game_logs.filter(game__year__in=years)
    yearly_cumulative_stats = {}
    for year in years:
        year_game_logs = player.game_logs.filter(game__year=year)

        year_stats = {
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

        # Accumulate stats for the year
        for game_log in year_game_logs:
            for key in year_stats.keys():
                year_stats[key] += getattr(game_log, key, 0)

        # derived stats
        year_stats["games"] = len(year_game_logs)

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
            year_stats["field_goals_made"],
            year_stats["field_goals_attempted"],
        )

        # Store the calculated stats for the year
        yearly_cumulative_stats[year] = year_stats

    # game logs for the selected year
    year = request.GET.get("year")
    if not year:
        game_logs = all_year_game_logs.filter(game__year=info.currentYear).order_by(
            "game__weekPlayed"
        )
    else:
        game_logs = all_year_game_logs.filter(game__year=year).order_by(
            "game__weekPlayed"
        )

    for game_log in game_logs:
        # derived stats
        game_log.completion_percent = percentage(
            game_log.pass_completions, game_log.pass_attempts
        )
        game_log.passer_rating = passer_rating(
            game_log.pass_completions,
            game_log.pass_attempts,
            game_log.pass_yards,
            game_log.pass_touchdowns,
            game_log.pass_interceptions,
        )
        game_log.yards_per_rush = average(game_log.rush_yards, game_log.rush_attempts)
        game_log.yards_per_rec = average(
            game_log.receiving_yards, game_log.receiving_catches
        )
        game_log.field_goal_percent = percentage(
            game_log.field_goals_made,
            game_log.field_goals_attempted,
        )

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

    context = {
        "years": years,
        "team": team,
        "player": player,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.order_by("confName"),
        "game_logs": game_logs,
        "yearly_cumulative_stats": yearly_cumulative_stats,
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
