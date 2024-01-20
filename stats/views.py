from django.shortcuts import render
from start.models import *
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce


def team(request):
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


def individual(request, category):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    team = info.team

    context = {
        "team": team,
        "info": info,
        "stats": individual_stats(info, category),
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    print(context["stats"])

    if category == "passing":
        return render(request, "passing.html", context)
    elif category == "rushing":
        return render(request, "rushing.html", context)


def individual_stats(info, category):
    stats = {}
    all_game_logs = info.game_logs.filter(game__year=info.currentYear)

    if category == "passing":
        players = info.players.filter(pos="qb", starter=True)
        for player in players:
            game_logs = all_game_logs.filter(player=player)

            stats[player] = accumulate_passing_stats(game_logs)

    return stats


def accumulate_passing_stats(game_logs):
    stats = {"att": 0, "cmp": 0, "yards": 0, "td": 0, "int": 0}

    for game_log in game_logs:
        stats["att"] += game_log.pass_attempts
        stats["cmp"] += game_log.pass_completions
        stats["yards"] += game_log.pass_yards
        stats["td"] += game_log.pass_touchdowns
        stats["int"] += game_log.pass_interceptions

    return stats


def accumulate_team_stats(team, games, plays):
    stats = {}
    pass_yards, rush_yards = 0, 0
    comp, att, rush_att = 0, 0, 0
    pass_td, rush_td = 0, 0
    int, fumble = 0, 0
    points = play_count = 0
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
                int += 1

        elif play.playType == "run":
            play_count += 1
            rush_yards += play.yardsGained
            if play.result == "run":
                rush_att += 1
            elif play.result == "touchdown":
                rush_att += 1
                rush_td += 1
            elif play.result == "fumble":
                fumble += 1

    if gamesPlayed:
        stats["ppg"] = round(points / gamesPlayed, 1)
        stats["pass_cpg"] = round(comp / gamesPlayed, 1)
        stats["pass_apg"] = round(att / gamesPlayed, 1)
        stats["pass_ypg"] = round(pass_yards / gamesPlayed, 1)
        stats["pass_tdpg"] = round(pass_td / gamesPlayed, 1)
        stats["rush_apg"] = round(rush_att / gamesPlayed, 1)
        stats["rush_ypg"] = round(rush_yards / gamesPlayed, 1)
        stats["rush_ypc"] = round(rush_yards / rush_att, 1)
        stats["rush_tdpg"] = round(rush_td / gamesPlayed, 1)
        stats["playspg"] = round(play_count / gamesPlayed, 1)
        stats["yardspg"] = round(stats["pass_ypg"] + stats["rush_ypg"], 1)
        stats["ypp"] = round(stats["yardspg"] / stats["playspg"], 1)
    else:
        stats["ppg"] = 0
        stats["pass_cpg"] = 0
        stats["pass_apg"] = 0
        stats["pass_ypg"] = 0
        stats["pass_tdpg"] = 0
        stats["rush_apg"] = 0
        stats["rush_ypg"] = 0
        stats["rush_ypc"] = 0
        stats["rush_tdpg"] = 0
        stats["playspg"] = 0
        stats["yardspg"] = 0
        stats["ypp"] = 0

    if att:
        stats["comp_percent"] = round(comp / att * 100, 1)
    else:
        stats["comp_percent"] = 0

    return stats
