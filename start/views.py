from django.http import JsonResponse
from django.shortcuts import render
import json
from .models import *
from django.db.models import F
from .util.util import *
from .util.sim.sim import simGame
import os


def simWeek(request, weeks):
    start = time.time()
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    all_games = info.games.all()

    team = info.team

    drives_to_create = []
    plays_to_create = []
    teamGames = []

    desired_week = info.currentWeek + weeks

    while info.currentWeek < desired_week:
        toBeSimmed = all_games.filter(weekPlayed=info.currentWeek)

        for game in toBeSimmed:
            if game.teamA == team:
                game.label = game.labelA
                teamGames.append(game)
            elif game.teamB == team:
                game.label = game.labelB
                teamGames.append(game)

            simGame(game, info, drives_to_create, plays_to_create)

        Games.objects.bulk_update(
            toBeSimmed, ["scoreA", "scoreB", "winner", "resultA", "resultB", "overtime"]
        )

        update_rankings_exceptions = {4: [14], 12: [14, 15, 16]}
        no_update_weeks = update_rankings_exceptions.get(info.playoff.teams, [])

        if info.currentWeek not in no_update_weeks:
            update_rankings(info)

        all_actions = {
            4: {
                12: setConferenceChampionships,
                13: setPlayoffSemi,
                14: setNatty,
                15: end_season,
            },
            12: {
                12: setConferenceChampionships,
                13: setPlayoffR1,
                14: setPlayoffQuarter,
                15: setPlayoffSemi,
                16: setNatty,
                17: end_season,
            },
        }

        action = all_actions.get(info.playoff.teams, {}).get(info.currentWeek)
        if action:
            action(info)

        info.currentWeek += 1

    make_game_logs(info, plays_to_create)
    Drives.objects.bulk_create(drives_to_create)
    Plays.objects.bulk_create(plays_to_create)
    info.save()

    context = {
        "conferences": info.conferences.all().order_by("confName"),
        "teamGames": teamGames,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    print(f"Sim games {time.time() - start} seconds")
    return render(request, "sim.html", context)


def home(request):
    if not request.session.session_key:
        request.session.create()

    user_id = request.session.session_key

    try:
        info = Info.objects.get(user_id=user_id)
    except:
        info = None

    context = {"info": info}

    return render(request, "launch.html", context)


def preview(request):
    user_id = request.session.session_key
    year = request.GET.get("year")

    with open(f"static/years/{year}.json", "r") as metadataFile:
        data = json.load(metadataFile)

        for conf in data["conferences"]:
            conf["teams"] = sorted(
                conf["teams"], key=lambda team: team["prestige"], reverse=True
            )

        info = init(data, user_id, year)

    context = {
        "info": info,
        "year": year,
        "data": data,
    }

    return render(request, "preview.html", context)


def pickteam(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    teams = info.teams.all().order_by("-prestige")

    context = {
        "teams": teams,
    }

    return render(request, "pickteam.html", context)


def game(request, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    game = info.games.get(id=id)

    if game.winner:
        return game_result(request, info, game)
    else:
        return game_preview(request, info, game)


def noncon(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    if not info.stage == "schedule non conference":
        id = request.GET.get("id")
        if id:
            team = info.teams.get(id=id)
            info.team = team
        else:
            current_year = info.currentYear + 1
            while current_year >= 2022:
                file_path = f"static/years/{current_year}.json"
                if os.path.exists(file_path):
                    with open(file_path, "r") as metadataFile:
                        data = json.load(metadataFile)

                    break
                else:
                    current_year -= 1

            update_teams_and_rosters(info, data)
            refresh_teams_and_games(info)
            uniqueGames(info, data)

        info.stage = "schedule non conference"
        info.save()

    team = info.team

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    schedule = sorted(schedule, key=lambda game: game.weekPlayed)

    class EmptyGame:
        pass

    full_schedule = [None] * 12

    for game in schedule:
        full_schedule[game.weekPlayed - 1] = game

    for index, week in enumerate(full_schedule):
        if week is not None:
            if week.teamA == team:
                week.opponent = week.teamB.name
                week.label = week.labelA
            else:
                week.opponent = week.teamA.name
                week.label = week.labelB
        else:
            empty_game = EmptyGame()
            empty_game.weekPlayed = index + 1
            empty_game.opponent = None
            empty_game.label = "No Game"
            full_schedule[index] = empty_game

    context = {
        "info": info,
        "schedule": full_schedule,
        "team": team,
        "conferences": info.conferences.all().order_by("confName"),
    }

    return render(request, "noncon.html", context)


def fetch_teams(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    week = int(request.GET.get("week"))

    scheduled_teams_as_teamA = info.games.filter(weekPlayed=week).values_list(
        "teamA", flat=True
    )

    scheduled_teams_as_teamB = info.games.filter(weekPlayed=week).values_list(
        "teamB", flat=True
    )
    scheduled_teams = scheduled_teams_as_teamA.union(scheduled_teams_as_teamB)

    opponents_as_teamA = info.games.filter(teamA=info.team).values_list(
        "teamB", flat=True
    )
    opponents_as_teamB = info.games.filter(teamB=info.team).values_list(
        "teamA", flat=True
    )
    all_opponents = opponents_as_teamA.union(opponents_as_teamB)

    teams = (
        info.teams.filter(nonConfGames__lt=F("nonConfLimit"))
        .exclude(id__in=scheduled_teams)
        .exclude(id__in=all_opponents)
        .exclude(id=info.team.id)
        .exclude(conference=info.team.conference)
        .order_by("name")
        .values_list("name", flat=True)
    )

    return JsonResponse(list(teams), safe=False)


def schedulenc(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    opponent_name = request.POST.get("opponent")
    week = int(request.POST.get("week"))

    team = info.team
    opponent = info.teams.get(name=opponent_name)

    team.schedule = opponent.schedule = set()

    games_to_create = []

    scheduleGame(
        info,
        team,
        opponent,
        games_to_create,
        week,
    )

    team.save()
    opponent.save()
    games_to_create[0].save()

    return JsonResponse({"status": "success"})


def dashboard(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.team

    if not info.stage == "season":
        start_season(info)

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    for week in schedule:
        week.team = team
        if week.teamA == team:
            week.opponent = week.teamB
            week.result = week.resultA
            week.score = f"{week.scoreA} - {week.scoreB}"
            week.spread = week.spreadA
            week.moneyline = week.moneylineA
        else:
            week.opponent = week.teamA
            week.result = week.resultB
            week.score = f"{week.scoreB} - {week.scoreA}"
            week.spread = week.spreadB
            week.moneyline = week.moneylineB

    teams = info.teams.order_by("ranking")
    confTeams = list(team.conference.teams.all())

    for team in confTeams:
        if team.confWins + team.confLosses > 0:
            team.pct = team.confWins / (team.confWins + team.confLosses)
        else:
            team.pct = 0

    confTeams.sort(key=lambda o: (-o.pct, -o.confWins, o.confLosses, o.ranking))

    context = {
        "team": team,
        "teams": teams,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "confTeams": confTeams,
        "conferences": info.conferences.all().order_by("confName"),
        "info": info,
        "schedule": schedule,
    }

    return render(request, "dashboard.html", context)


def game_preview(request, info, game):
    context = {
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.all().order_by("confName"),
    }

    return render(request, "game_preview.html", context)


def game_result(request, info, game):
    team = info.team
    drives = game.drives.all()
    game_logs = game.game_logs.all()

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
            qb_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - K): {game_log.field_goals_made}/{game_log.field_goals_made} FG",
            }
            categorized_game_log_strings["Kicking"].append(qb_game_log_dict)

    scoreA = scoreB = 0
    for drive in drives:
        if drive.offense == game.teamA:
            if drive.points:
                scoreA += drive.points
            elif drive.result == "safety":
                scoreB += 2
        elif drive.offense == game.teamB:
            if drive.points:
                scoreB += drive.points
            elif drive.result == "safety":
                scoreA += 2
        drive.teamAfter = scoreA
        drive.oppAfter = scoreB

    context = {
        "team": team,
        "game": game,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "info": info,
        "conferences": info.conferences.all().order_by("confName"),
        "drives": drives,
        "stats": game_stats(game),
        "categorized_game_log_strings": categorized_game_log_strings,
    }

    return render(request, "game_result.html", context)


def season_summary(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    info.stage = "season summary"
    info.save()

    context = {
        "info": info,
        "natty": info.playoff.natty,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    return render(request, "season_summary.html", context)


def roster_progression(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    if not info.stage == "roster progression":
        start = time.time()
        rosters_update = update_rosters(info)
        print(f"Roster update {time.time() - start} seconds")

        info.stage = "roster progression"
        info.save()

        context = {
            "info": info,
            "leaving_seniors": rosters_update["leaving_seniors"],
            "progressed_players": rosters_update["progressed_players"],
        }
    else:
        context = {
            "info": info,
        }

    return render(request, "roster_progression.html", context)
