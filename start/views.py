from django.http import JsonResponse
from django.shortcuts import render
import json
from .models import *
from django.db.models import F
from util.util import *
from util.sim.sim import simGame
import os
from django.conf import settings
from util.sim.sim import DRIVES_PER_TEAM


def simWeek(request):
    start = time.time()
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    games = info.games.filter(year=info.currentYear, weekPlayed=info.currentWeek)
    live = request.GET.get("live")

    team = info.team

    drives_to_create = []
    plays_to_create = []
    teamGames = []
    teamGame = None

    start = overall_start = time.time()
    for game in games:
        if game.teamA == team:
            game.label = game.labelA
            teamGame = game
            teamGames.append(game)
        elif game.teamB == team:
            game.label = game.labelB
            teamGame = game
            teamGames.append(game)

        simGame(game, info, drives_to_create, plays_to_create)

    Games.objects.bulk_update(
        games, ["scoreA", "scoreB", "winner", "resultA", "resultB", "overtime"]
    )
    print(f"Sim {time.time() - start} seconds")

    update_rankings_exceptions = {4: [14], 12: [14, 15, 16]}
    no_update_weeks = update_rankings_exceptions.get(info.playoff.teams, [])

    if info.currentWeek not in no_update_weeks:
        update_rankings(info)

    all_actions = {
        2: {
            12: setConferenceChampionships,
            13: setNatty,
            14: end_season,
        },
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

    start = time.time()
    make_game_logs(info, plays_to_create)
    Drives.objects.bulk_create(drives_to_create)
    Plays.objects.bulk_create(plays_to_create)
    info.save()
    print(f"Game logs {time.time() - start} seconds")

    context = {
        "conferences": info.conferences.all().order_by("confName"),
        "teamGames": teamGames,
        "game": teamGame,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    print(f"Total {time.time() - overall_start} seconds")

    if live and teamGame:
        plays = list(teamGame.plays.all())
        for i in range(len(plays) - 1):  # Stop one element before the last
            play = plays[i]
            next_play = plays[i + 1]
            if play.game == next_play.game:
                play.next_play_id = next_play.id
        Plays.objects.bulk_update(plays, ["next_play_id"])

        return render(request, "sim_live.html", context)
    else:
        return render(request, "sim.html", context)


def home(request):
    if not request.session.session_key:
        request.session.create()

    user_id = request.session.session_key

    try:
        info = Info.objects.get(user_id=user_id)
    except:
        info = None

    # Path to the 'years' directory
    years_dir = os.path.join(settings.BASE_DIR, "static", "years")

    # List all JSON files and extract the year part from their names
    years = [f.split(".")[0] for f in os.listdir(years_dir) if f.endswith(".json")]
    years.sort(reverse=True)  # Sort years in descending order

    context = {"info": info, "years": years}  # Add the years to the context

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

        data["independents"] = sorted(
            data["independents"], key=lambda team: team["prestige"], reverse=True
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
            info.currentYear += 1
            current_year = info.currentYear
            while current_year >= info.startYear:
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

    games_as_teamA = team.games_as_teamA.filter(year=info.currentYear)
    games_as_teamB = team.games_as_teamB.filter(year=info.currentYear)
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

    games = info.games.filter(year=info.currentYear)

    scheduled_teams_as_teamA = games.filter(weekPlayed=week).values_list(
        "teamA", flat=True
    )
    scheduled_teams_as_teamB = games.filter(weekPlayed=week).values_list(
        "teamB", flat=True
    )
    scheduled_teams = scheduled_teams_as_teamA.union(scheduled_teams_as_teamB)

    opponents_as_teamA = games.filter(teamA=info.team).values_list("teamB", flat=True)
    opponents_as_teamB = games.filter(teamB=info.team).values_list("teamA", flat=True)
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


def fetch_play(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    last_play_id = request.GET.get("current_play_id")
    last_play_text = last_play_yards = None

    if last_play_id:
        last_play = info.plays.get(id=last_play_id)
        current_play = info.plays.filter(id=last_play.next_play_id).first()
        last_play_text = f"{last_play.header}: {last_play.text}"
        if last_play.result != "touchdown":
            last_play_yards = last_play.yardsGained

    else:
        game_id = request.GET.get("game_id")
        game = info.games.get(id=game_id)
        current_play = game.plays.first()

    if not current_play:
        game_id = request.GET.get("game_id")
        game = info.games.get(id=game_id)
        teamA = game.teamA.name
        teamB = game.teamB.name

        return JsonResponse(
            {
                "status": "finished",
                "teamA": teamA,
                "teamB": teamB,
                "scoreA": game.scoreA,
                "scoreB": game.scoreB,
                "last_play_text": last_play_text,
                "ot": game.overtime,
            }
        )

    offense = current_play.offense.name
    teamA = current_play.game.teamA.name
    teamB = current_play.game.teamB.name
    colorAPrimary = current_play.game.teamA.colorPrimary
    colorASecondary = current_play.game.teamA.colorSecondary
    colorBPrimary = current_play.game.teamB.colorPrimary
    colorBSecondary = current_play.game.teamB.colorSecondary

    if offense == teamA:
        ballPosition = lineOfScrimmage = current_play.startingFP
        firstDownLine = current_play.yardsLeft + current_play.startingFP
    else:
        ballPosition = lineOfScrimmage = 100 - current_play.startingFP
        firstDownLine = 100 - (current_play.yardsLeft + current_play.startingFP)

    completed_drives = []
    if current_play:
        drive_num = (
            current_play.drive.driveNum // 2
        ) + 1  # Adjust to start from 1 and have two drives per number
        drive_fraction = f"{drive_num}/{DRIVES_PER_TEAM}"
        if drive_num > DRIVES_PER_TEAM:
            drive_fraction = "OT"

        for drive in current_play.game.drives.exclude(result__isnull=True):
            if drive.id < current_play.drive.id:
                # Calculate yards gained using the drive's own data
                if drive.offense == current_play.game.teamA:
                    yards_gained = drive.startingFP - drive.plays.last().startingFP
                else:
                    yards_gained = drive.plays.last().startingFP - drive.startingFP

                adjusted_drive_num = (drive.driveNum // 2) + 1  # Adjust drive number

                completed_drives.append(
                    {
                        "offense": drive.offense.name,
                        "offense_color": drive.offense.colorPrimary,
                        "offense_secondary_color": drive.offense.colorSecondary,
                        "yards": yards_gained,
                        "result": drive.result,
                        "points": drive.points,
                        "scoreA": drive.scoreAAfter,
                        "scoreB": drive.scoreBAfter,
                        "driveNum": adjusted_drive_num,
                    }
                )

    return JsonResponse(
        {
            "status": "success",
            "offense": offense,
            "teamA": teamA,
            "teamB": teamB,
            "colorAPrimary": colorAPrimary,
            "colorBPrimary": colorBPrimary,
            "colorASecondary": colorASecondary,
            "colorBSecondary": colorBSecondary,
            "ballPosition": ballPosition,
            "lineOfScrimmage": lineOfScrimmage,
            "firstDownLine": firstDownLine,
            "lastPlayYards": last_play_yards,
            "scoreA": current_play.scoreA,
            "scoreB": current_play.scoreB,
            "current_play_header": current_play.header,
            "last_play_text": last_play_text,
            "current_play_id": current_play.id,
            "completed_drives": completed_drives,
            "drive_fraction": drive_fraction,
        }
    )


def dashboard(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.team

    if not info.stage == "season":
        start_season(info)

    games_as_teamA = team.games_as_teamA.filter(year=info.currentYear)
    games_as_teamB = team.games_as_teamB.filter(year=info.currentYear)
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

    if team.conference:
        confTeams = list(team.conference.teams.all())
        for team in confTeams:
            if team.confWins + team.confLosses > 0:
                team.pct = team.confWins / (team.confWins + team.confLosses)
            else:
                team.pct = 0

        confTeams.sort(key=lambda o: (-o.pct, -o.confWins, o.confLosses, o.ranking))
    else:
        confTeams = teams.filter(conference=None)

    context = {
        "teams": teams,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "confTeams": confTeams,
        "conferences": info.conferences.all().order_by("confName"),
        "info": info,
        "schedule": schedule,
    }

    return render(request, "dashboard.html", context)


def game_preview(request, info, game):
    if game.labelA == game.labelB:
        game.label = game.labelA
    else:
        game.label = (
            f"NC ({game.teamA.conference.confName} vs {game.teamB.conference.confName})"
        )

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

    # Zip the two lists together
    top_players = list(zip(top_players_a, top_players_b))

    context = {
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "conferences": info.conferences.all().order_by("confName"),
        "game": game,
        "top_players": top_players,
    }

    return render(request, "game_preview.html", context)


def game_result(request, info, game):
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
            k_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - K): {game_log.field_goals_made}/{game_log.field_goals_attempted} FG",
            }
            categorized_game_log_strings["Kicking"].append(k_game_log_dict)

    context = {
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
    info.save()

    context = {
        "info": info,
        "natty": info.playoff.natty,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "realignment": realignment_summary(info),
    }

    return render(request, "season_summary.html", context)


def roster_progression(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    # Update rosters and info if not in "roster progression" stage
    if info.stage != "roster progression":
        start = time.time()
        rosters_update = update_rosters(info)
        print(f"Roster update {time.time() - start} seconds")

        info.stage = "roster progression"
        info.save()
    else:
        rosters_update = None

    # Retrieve progressed players after potential roster update
    progressed = info.team.players.all()
    for player in progressed:
        if player.year == "so":
            player.change = player.rating - player.rating_fr
        elif player.year == "jr":
            player.change = player.rating - player.rating_so
        elif player.year == "sr":
            player.change = player.rating - player.rating_jr

    # Prepare context
    context = {"info": info, "progressed": progressed}

    # Add 'leaving' key only if rosters were updated
    if rosters_update:
        context["leaving"] = rosters_update["leaving"]

    return render(request, "roster_progression.html", context)
