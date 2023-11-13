from django.http import JsonResponse
from django.shortcuts import render
import json
from .models import *
from django.db.models import F
from .util.util import *
from .util.sim.sim import simGame
import os


def make_game_logs(info, plays):
    desired_positions = {"qb", "rb", "wr"}
    game_log_dict = {}

    # Get all starters outside of the play loop
    all_starters = Players.objects.filter(
        info=info, starter=True, pos__in=desired_positions
    ).select_related("team")

    # Group them by position and team
    starters_by_team_pos = {(player.team, player.pos): [] for player in all_starters}
    for player in all_starters:
        starters_by_team_pos[(player.team, player.pos)].append(player)

    # Get all unique games being simmed
    simmed_games = {play.game for play in plays}

    # Create a set to store (player, game) combinations for GameLog objects
    player_game_combinations = set()

    for game in simmed_games:
        for team in [game.teamA, game.teamB]:
            for pos in desired_positions:
                starters = starters_by_team_pos.get((team, pos), [])
                for starter in starters:
                    player_game_combinations.add((starter, game))

    # Create the in-memory GameLog objects
    game_logs_to_process = [
        GameLog(info=info, player=player, game=game)
        for player, game in player_game_combinations
    ]

    for game_log in game_logs_to_process:
        game_log_dict[(game_log.player, game_log.game)] = game_log

    # Main logic for processing the plays
    for play in plays:
        game = play.game
        offense_team = play.offense

        rb_starters = starters_by_team_pos.get((offense_team, "rb"), [])
        qb_starters = starters_by_team_pos.get((offense_team, "qb"), [])
        wr_starters = starters_by_team_pos.get((offense_team, "wr"), [])

        if play.playType == "run":
            runner = random.choice(rb_starters) if rb_starters else None
            if runner:
                game_log = game_log_dict[(runner, game)]
                update_game_log_for_run(play, game_log)
                format_play_text(play, runner)

        elif play.playType == "pass":
            qb_starter = qb_starters[0] if qb_starters else None
            receiver = random.choice(wr_starters) if wr_starters else None
            if qb_starter and receiver:
                qb_game_log = game_log_dict[(qb_starter, game)]
                receiver_game_log = game_log_dict[(receiver, game)]
                update_game_log_for_pass(play, qb_game_log, receiver_game_log)
                format_play_text(play, qb_starter, receiver)

    GameLog.objects.bulk_create(game_logs_to_process)


def simWeek(request, weeks):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.team

    drives_to_create = []
    plays_to_create = []
    teamGames = []

    desired_week = info.currentWeek + weeks

    while info.currentWeek < desired_week:
        toBeSimmed = list(Games.objects.filter(info=info, weekPlayed=info.currentWeek))

        for game in toBeSimmed:
            if game.teamA == team:
                game.label = game.labelA
                teamGames.append(game)
            elif game.teamB == team:
                game.label = game.labelB
                teamGames.append(game)

            simGame(game, info, drives_to_create, plays_to_create)

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

    game = Games.objects.get(id=id)

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
            team = Teams.objects.get(id=id)
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
            refresh_schedule(info)
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

    scheduled_teams_as_teamA = Games.objects.filter(
        info=info, weekPlayed=week
    ).values_list("teamA", flat=True)

    scheduled_teams_as_teamB = Games.objects.filter(
        info=info, weekPlayed=week
    ).values_list("teamB", flat=True)

    scheduled_teams = scheduled_teams_as_teamA.union(scheduled_teams_as_teamB)

    opponents_as_teamA = Games.objects.filter(info=info, teamA=info.team).values_list(
        "teamB", flat=True
    )
    opponents_as_teamB = Games.objects.filter(info=info, teamB=info.team).values_list(
        "teamA", flat=True
    )
    all_opponents = opponents_as_teamA.union(opponents_as_teamB)

    eligible_teams = (
        Teams.objects.filter(info=info, nonConfGames__lt=F("nonConfLimit"))
        .exclude(id__in=scheduled_teams)
        .exclude(
            id__in=all_opponents
        )  # Exclude all teams that info.team has played against
        .exclude(id=info.team.id)
        .exclude(conference=info.team.conference)
        .order_by("name")
        .values_list("name", flat=True)
    )

    teams = list(eligible_teams)

    return JsonResponse(teams, safe=False)


def schedulenc(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    opponent_name = request.POST.get("opponent")
    week = int(request.POST.get("week"))

    team = info.team
    opponent = Teams.objects.get(info=info, name=opponent_name)

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

    teams = Teams.objects.filter(info=info).order_by("ranking")
    confTeams = Teams.objects.filter(info=info, conference=team.conference).order_by(
        "-confWins", "-resume"
    )

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
    conferences = info.conferences.all().order_by("confName")
    team = info.team
    drives = game.drives.all()
    game_logs = game.game_logs.all()

    # Initialize an empty dictionary to store categorized game log strings
    categorized_game_log_strings = {"Passing": [], "Rushing": [], "Receiving": []}

    for game_log in game_logs:
        player = game_log.player
        position = player.pos  # Assuming 'position' is a field on your 'Players' model
        team_name = (
            player.team.name
        )  # Assuming 'team' is a field on your 'Players' model

        if "qb" in position.lower():
            qb_game_log_dict = {
                "player_id": player.id,  # Assuming 'id' is a field on your 'Players' model
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - QB): {game_log.pass_completions}/{game_log.pass_attempts} for {game_log.pass_yards} yards, {game_log.pass_touchdowns} TDs, {game_log.pass_interceptions} INTs",
            }
            categorized_game_log_strings["Passing"].append(qb_game_log_dict)

        if "rb" in position.lower() or (
            "qb" in position.lower() and game_log.rush_attempts > 0
        ):  # Include QBs with rushing attempts
            rush_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.rush_attempts} carries, {game_log.rush_yards} yards, {game_log.rush_touchdowns} TDs",
            }
            categorized_game_log_strings["Rushing"].append(rush_game_log_dict)

        if "wr" in position.lower() or (
            "rb" in position.lower() and game_log.receiving_catches > 0
        ):  # Include RBs with receptions
            recv_game_log_dict = {
                "player_id": player.id,
                "team_name": team_name,
                "game_log_string": f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.receiving_catches} catches, {game_log.receiving_yards} yards, {game_log.receiving_touchdowns} TDs",
            }
            categorized_game_log_strings["Receiving"].append(recv_game_log_dict)

    # if game.teamA == team:
    #     game.opponent = game.teamB
    #     game.team.score = game.scoreA
    #     game.opponent.score = game.scoreB
    # else:
    #     game.opponent = game.teamA
    #     game.team.score = game.scoreB
    #     game.opponent.score = game.scoreA

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

    team_yards = opp_yards = 0
    team_passing_yards = team_rushing_yards = opp_passing_yards = opp_rushing_yards = 0
    team_first_downs = opp_first_downs = 0
    team_third_down_a = team_third_down_c = opp_third_down_a = opp_third_down_c = 0
    team_fourth_down_a = team_fourth_down_c = opp_fourth_down_a = opp_fourth_down_c = 0
    team_turnovers = opp_turnovers = 0
    for play in game.plays.all():
        if play.startingFP < 50:
            location = f"{play.offense.abbreviation} {play.startingFP}"
        elif play.startingFP > 50:
            location = f"{play.defense.abbreviation} {100 - play.startingFP}"
        else:
            location = f"{play.startingFP}"

        if play.startingFP + play.yardsLeft >= 100:
            if play.down == 1:
                play.header = f"{play.down}st and goal at {location}"
            elif play.down == 2:
                play.header = f"{play.down}nd and goal at {location}"
            elif play.down == 3:
                play.header = f"{play.down}rd and goal at {location}"
            elif play.down == 4:
                play.header = f"{play.down}th and goal at {location}"
        else:
            if play.down == 1:
                play.header = f"{play.down}st and {play.yardsLeft} at {location}"
            elif play.down == 2:
                play.header = f"{play.down}nd and {play.yardsLeft} at {location}"
            elif play.down == 3:
                play.header = f"{play.down}rd and {play.yardsLeft} at {location}"
            elif play.down == 4:
                play.header = f"{play.down}th and {play.yardsLeft} at {location}"

        play.save()

        if play.offense == game.teamA:
            if play.playType == "pass":
                team_passing_yards += play.yardsGained
            elif play.playType == "run":
                team_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                team_first_downs += 1
            if play.result == "interception" or play.result == "fumble":
                team_turnovers += 1
            elif play.down == 3:
                team_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    team_third_down_c += 1
            elif play.down == 4:
                if play.playType != "punt" and play.playType != "field goal attempt":
                    team_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        team_fourth_down_c += 1
        elif play.offense == game.teamB:
            if play.playType == "pass":
                opp_passing_yards += play.yardsGained
            elif play.playType == "run":
                opp_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                opp_first_downs += 1
            if play.result == "interception" or play.result == "fumble":
                opp_turnovers += 1
            elif play.down == 3:
                opp_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    opp_third_down_c += 1
            elif play.down == 4:
                if play.playType != "punt" and play.playType != "field goal attempt":
                    opp_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        opp_fourth_down_c += 1

    team_yards = team_passing_yards + team_rushing_yards
    opp_yards = opp_passing_yards + opp_rushing_yards

    stats = {
        "total yards": {"team": team_yards, "opponent": opp_yards},
        "passing yards": {"team": team_passing_yards, "opponent": opp_passing_yards},
        "rushing yards": {"team": team_rushing_yards, "opponent": opp_rushing_yards},
        "1st downs": {"team": team_first_downs, "opponent": opp_first_downs},
        "3rd down conversions": {
            "team": team_third_down_c,
            "opponent": opp_third_down_c,
        },
        "3rd down attempts": {"team": team_third_down_a, "opponent": opp_third_down_a},
        "4th down conversions": {
            "team": team_fourth_down_c,
            "opponent": opp_fourth_down_c,
        },
        "4th down attempts": {
            "team": team_fourth_down_a,
            "opponent": opp_fourth_down_a,
        },
        "turnovers": {"team": team_turnovers, "opponent": opp_turnovers},
    }

    context = {
        "team": team,
        "game": game,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "info": info,
        "conferences": conferences,
        "drives": drives,
        "stats": stats,
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

    players = info.players.all()

    if not info.stage == "roster progression":
        rosters_update = update_rosters(players)
        info.stage = "roster progression"
        info.save(update_fields=["stage"])

        leaving_seniors_of_team = [
            player
            for player in rosters_update["leaving_seniors"]
            if player.team == info.team
        ]

        progressed_players_of_team = [
            player
            for player in rosters_update["progressed_players"]
            if player.team == info.team
        ]

        context = {
            "info": info,
            "leaving_seniors": leaving_seniors_of_team,
            "progressed_players": progressed_players_of_team,
        }
    else:
        context = {
            "info": info,
        }

    return render(request, "roster_progression.html", context)
