from django.shortcuts import render
from start.models import *
from django.db.models import Q
from logic.stats import *

MIN_YARDS = 100


def team_stats(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    all_games = info.games.filter(year=info.currentYear, winner__isnull=False)
    plays = info.plays.all()

    offense = {}
    defense = {}

    for team in info.teams.all():
        games = all_games.filter(Q(teamA=team) | Q(teamB=team))

        offense[team.name] = accumulate_team_stats(
            team, games, plays.filter(offense=team)
        )
        defense[team.name] = accumulate_team_stats(
            team, games, plays.filter(defense=team)
        )

    context = {
        "info": info,
        "conferences": info.conferences.all(),
        "offense": offense,
        "defense": defense,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    return render(request, "team.html", context)


def stat_categories(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    team = info.team

    context = {
        "team": team,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    return render(request, "individual.html", context)


def individual_stats(request, category):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    team = info.team

    context = {
        "team": team,
        "info": info,
        "stats": accumulate_individual_stats(info, category),
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    if category == "passing":
        return render(request, "passing.html", context)
    elif category == "rushing":
        return render(request, "rushing.html", context)
    elif category == "receiving":
        return render(request, "receiving.html", context)


def accumulate_individual_stats(info, category):
    stats = {}
    all_game_logs = info.game_logs.filter(game__year=info.currentYear)

    if category == "passing":
        players = info.players.filter(pos="qb", starter=True)
        for player in players:
            game_logs = all_game_logs.filter(player=player)

            stats[player] = accumulate_passing_stats(game_logs)
    elif category == "rushing":
        players = info.players.filter(Q(pos="qb") | Q(pos="rb"), starter=True)
        temp_stats = {}

        for player in players:
            game_logs = all_game_logs.filter(player=player)
            player_stats = accumulate_rushing_stats(game_logs)

            if player_stats["yards"] >= MIN_YARDS:
                temp_stats[player] = player_stats

        stats = temp_stats
    elif category == "receiving":
        players = info.players.filter(
            Q(pos="rb") | Q(pos="wr") | Q(pos="te"), starter=True
        )

        temp_stats = {}

        for player in players:
            game_logs = all_game_logs.filter(player=player)
            player_stats = accumulate_receiving_stats(game_logs)

            if player_stats["yards"] >= MIN_YARDS:
                temp_stats[player] = player_stats

        stats = temp_stats

    return stats


def accumulate_passing_stats(game_logs):
    stats = {"att": 0, "cmp": 0, "yards": 0, "td": 0, "int": 0}

    if game_logs:
        for game_log in game_logs:
            stats["att"] += game_log.pass_attempts
            stats["cmp"] += game_log.pass_completions
            stats["yards"] += game_log.pass_yards
            stats["td"] += game_log.pass_touchdowns
            stats["int"] += game_log.pass_interceptions

        stats["pct"] = percentage(stats["cmp"], stats["att"])
        stats["passer_rating"] = passer_rating(
            stats["cmp"], stats["att"], stats["yards"], stats["td"], stats["int"]
        )
        stats["adjusted_pass_yards_per_attempt"] = adjusted_pass_yards_per_attempt(
            stats["yards"], stats["td"], stats["int"], stats["att"]
        )
        stats["yards_per_game"] = average(
            stats["yards"], game_log.player.team.gamesPlayed
        )

    return stats


def accumulate_rushing_stats(game_logs):
    stats = {"att": 0, "yards": 0, "td": 0, "fumbles": 0}

    if game_logs:
        for game_log in game_logs:
            stats["att"] += game_log.rush_attempts
            stats["yards"] += game_log.rush_yards
            stats["td"] += game_log.rush_touchdowns
            stats["fumbles"] += game_log.fumbles

        stats["yards_per_rush"] = average(stats["yards"], stats["att"])
        stats["yards_per_game"] = average(
            stats["yards"], game_log.player.team.gamesPlayed
        )

    return stats


def accumulate_receiving_stats(game_logs):
    stats = {"rec": 0, "yards": 0, "td": 0}

    if game_logs:
        for game_log in game_logs:
            stats["rec"] += game_log.receiving_catches
            stats["yards"] += game_log.receiving_yards
            stats["td"] += game_log.receiving_touchdowns

        stats["yards_per_rec"] = average(stats["yards"], stats["rec"])
        stats["yards_per_game"] = average(
            stats["yards"], game_log.player.team.gamesPlayed
        )

    return stats


def accumulate_team_stats(team, games, plays):
    stats = {}
    pass_yards = rush_yards = 0
    comp = att = rush_att = 0
    pass_td = rush_td = 0
    fumbles = interceptions = 0
    points = 0
    play_count = 0
    first_downs_pass = first_downs_rush = first_downs_total = 0

    gamesPlayed = team.gamesPlayed
    stats["games"] = gamesPlayed

    for game in games:
        if game.teamA == team:
            points += game.scoreA
        else:
            points += game.scoreB

    for play in plays:
        if play.playType == "pass":
            play_count += 1
            pass_yards += play.yardsGained
            if play.result == "pass":
                comp += 1
                att += 1
            elif play.result == "touchdown":
                comp += 1
                att += 1
                pass_td += 1
            elif play.result == "incomplete pass":
                att += 1
            elif play.result == "interception":
                att += 1
                interceptions += 1

            if play.yardsGained >= play.yardsLeft:
                first_downs_pass += 1

        elif play.playType == "run":
            play_count += 1
            rush_yards += play.yardsGained
            if play.result == "run":
                rush_att += 1
            elif play.result == "touchdown":
                rush_att += 1
                rush_td += 1
            elif play.result == "fumble":
                fumbles += 1

            if play.yardsGained >= play.yardsLeft:
                first_downs_rush += 1

    total_yards = pass_yards + rush_yards
    first_downs_total = first_downs_pass + first_downs_rush
    turnovers = fumbles + interceptions

    stats["ppg"] = average(points, gamesPlayed)
    stats["pass_cpg"] = average(comp, gamesPlayed)
    stats["pass_apg"] = average(att, gamesPlayed)
    stats["pass_ypg"] = average(pass_yards, gamesPlayed)
    stats["pass_tdpg"] = average(pass_td, gamesPlayed)
    stats["rush_apg"] = average(rush_att, gamesPlayed)
    stats["rush_ypg"] = average(rush_yards, gamesPlayed)
    stats["rush_ypc"] = average(rush_yards, rush_att)
    stats["rush_tdpg"] = average(rush_td, gamesPlayed)
    stats["playspg"] = average(play_count, gamesPlayed)
    stats["yardspg"] = average(total_yards, gamesPlayed)
    stats["ypp"] = average(total_yards, play_count)
    stats["comp_percent"] = percentage(comp, att)
    stats["first_downs_pass"] = average(first_downs_pass, gamesPlayed)
    stats["first_downs_rush"] = average(first_downs_rush, gamesPlayed)
    stats["first_downs_total"] = average(first_downs_total, gamesPlayed)
    stats["fumbles"] = average(fumbles, gamesPlayed)
    stats["interceptions"] = average(interceptions, gamesPlayed)
    stats["turnovers"] = average(turnovers, gamesPlayed)

    return stats
