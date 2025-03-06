from django.http import JsonResponse
from django.shortcuts import render
import json
from .models import *
from django.db.models import F
from logic.util import *
from logic.sim.sim import simGame
import os
from django.conf import settings
from logic.sim.sim import DRIVES_PER_TEAM
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import *
import uuid


@api_view(["GET"])
def home(request):
    """API endpoint for the launch page data"""
    user_id = request.headers.get("X-User-ID")
    year = request.GET.get("year")

    try:
        info = Info.objects.get(user_id=user_id)
        info_data = InfoSerializer(info).data
    except Info.DoesNotExist:
        info_data = None

    years = [
        f.split(".")[0]
        for f in os.listdir(settings.YEARS_DATA_DIR)
        if f.endswith(".json")
    ]
    years.sort(reverse=True)

    # Get preview data for the selected year
    preview_data = None
    if year:
        with open(f"{settings.YEARS_DATA_DIR}/{year}.json", "r") as metadataFile:
            preview_data = json.load(metadataFile)

            # Sort teams by prestige within each conference
            for conf in preview_data["conferences"]:
                conf["teams"] = sorted(
                    conf["teams"], key=lambda team: team["prestige"], reverse=True
                )

    return Response({"info": info_data, "years": years, "preview": preview_data})


@api_view(["GET"])
def noncon(request):
    """API endpoint for non-conference scheduling page"""
    user_id = request.headers.get("X-User-ID")
    team = request.GET.get("team")
    year = request.GET.get("year")
    new_game = request.GET.get("new_game")
    replace = False

    if new_game == "true":
        user_id = str(uuid.uuid4())
        replace = True
        init(user_id, team, year)

    info = Info.objects.get(user_id=user_id)
    team = info.team

    # Get and process schedule
    games_as_teamA = team.games_as_teamA.filter(year=info.currentYear)
    games_as_teamB = team.games_as_teamB.filter(year=info.currentYear)
    schedule = list(games_as_teamA | games_as_teamB)

    # Process each game to include only the fields we want
    processed_schedule = []
    for game in schedule:
        # Determine if user's team is teamA or teamB and create appropriate game data
        if game.teamA == team:
            game_data = {
                "weekPlayed": game.weekPlayed,
                "opponent": game.teamB.name,
                "label": game.labelA,
            }
        else:
            game_data = {
                "weekPlayed": game.weekPlayed,
                "opponent": game.teamA.name,
                "label": game.labelB,
            }
        processed_schedule.append(game_data)

    # Create schedule mapping
    game_weeks = {game["weekPlayed"]: game for game in processed_schedule}

    # Build full schedule
    full_schedule = []
    for week in range(1, 13):
        if week in game_weeks:
            full_schedule.append(game_weeks[week])
        else:
            full_schedule.append(
                {
                    "weekPlayed": week,
                    "opponent": None,
                }
            )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(team).data,
            "schedule": full_schedule,
            "user_id": user_id,
            "replace": replace,
            "conferences": ConferencesSerializer(
                info.conferences.all(), many=True
            ).data,
        }
    )


@api_view(["GET"])
def fetch_teams(request):
    """API endpoint to fetch available teams for a given week"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    week = request.GET.get("week")

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


@api_view(["POST"])
def schedule_nc(request):
    """API endpoint to schedule a non-conference game"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    week = request.data.get("week")
    team = info.team
    opponent = info.teams.get(name=request.data.get("opponent"))

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

    return Response({"status": "success"})


@api_view(["GET"])
def dashboard(request):
    def process_game_data(game, team):
        """Helper function to process game data for a team"""
        if not game:
            return None

        is_team_a = game.teamA == team
        opponent = game.teamB if is_team_a else game.teamA

        data = {
            "weekPlayed": game.weekPlayed,
            "opponent": {
                "name": opponent.name,
                "ranking": opponent.ranking,
            },
        }

        # Add result/score for previous game or spread/moneyline for current game
        if game.winner:
            data.update(
                {
                    "result": game.resultA if is_team_a else game.resultB,
                    "score": (
                        f"{game.scoreA} - {game.scoreB}"
                        if is_team_a
                        else f"{game.scoreB} - {game.scoreA}"
                    ),
                }
            )
        else:
            data.update(
                {
                    "spread": game.spreadA if is_team_a else game.spreadB,
                    "moneyline": game.moneylineA if is_team_a else game.moneylineB,
                }
            )

        return data

    """API endpoint for dashboard data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.team

    if not info.stage == "season":
        start_season(info)

    # Get and process games
    prev_week_game = (
        team.games_as_teamA.filter(
            year=info.currentYear, weekPlayed=info.currentWeek - 1
        )
        | team.games_as_teamB.filter(
            year=info.currentYear, weekPlayed=info.currentWeek - 1
        )
    ).first()

    current_week_game = (
        team.games_as_teamA.filter(year=info.currentYear, weekPlayed=info.currentWeek)
        | team.games_as_teamB.filter(year=info.currentYear, weekPlayed=info.currentWeek)
    ).first()

    return Response(
        {
            "info": InfoSerializer(info).data,
            "prev_game": process_game_data(prev_week_game, team),
            "curr_game": process_game_data(current_week_game, team),
            "team": TeamsSerializer(team).data,
            "confTeams": TeamsSerializer(team.conference.teams.all(), many=True).data,
            "top_10": TeamsSerializer(
                info.teams.order_by("ranking")[:10], many=True
            ).data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


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
def schedule(request, team_name):
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
        list(games_as_teamA | games_as_teamB),
        key=lambda game: game.weekPlayed
    )

    processed_schedule = []
    for game in schedule:
        is_team_a = game.teamA == team
        opponent = game.teamB if is_team_a else game.teamA
        
        game_data = {
            "id": game.id,
            "weekPlayed": game.weekPlayed,
            "opponent": {
                "name": opponent.name,
                "rating": opponent.rating,
                "ranking": opponent.ranking,
                "record": f"{opponent.totalWins}-{opponent.totalLosses} ({opponent.confWins}-{opponent.confLosses})"
            },
            "label": game.labelA if is_team_a else game.labelB,
            "moneyline": game.moneylineA if is_team_a else game.moneylineB,
            "spread": game.spreadA if is_team_a else game.spreadB,
            "result": game.resultA if is_team_a else game.resultB,
        }

        # Handle score and overtime
        score_a = game.scoreA if is_team_a else game.scoreB
        score_b = game.scoreB if is_team_a else game.scoreA
        
        if game.overtime:
            ot_text = "OT" if game.overtime == 1 else f"{game.overtime}OT"
            game_data["score"] = f"{score_a}-{score_b} {ot_text}"
        else:
            game_data["score"] = f"{score_a}-{score_b}"
            
        processed_schedule.append(game_data)

    years = list(range(info.currentYear, info.startYear - 1, -1))

    return Response({
        "info": InfoSerializer(info).data,
        "team": TeamsSerializer(team).data,
        "games": processed_schedule,
        "years": years,
        "conferences": ConferenceNameSerializer(
            info.conferences.all().order_by("confName"), many=True
        ).data,
        "teams": TeamBasicSerializer(info.teams.all().order_by('name'), many=True).data,
    })


def get_last_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(
        year=info.currentYear, weekPlayed=info.currentWeek - 1
    )
    games_as_teamB = team.games_as_teamB.filter(
        year=info.currentYear, weekPlayed=info.currentWeek - 1
    )
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        last_game = schedule[-1]
        if last_game.teamA == team:
            last_game.opponent = last_game.teamB
            last_game.result = last_game.resultA
            last_game.rank = last_game.rankBTOG
            if not last_game.overtime:
                last_game.score = f"{last_game.scoreA} - {last_game.scoreB}"
            else:
                if last_game.overtime == 1:
                    last_game.score = f"{last_game.scoreA} - {last_game.scoreB} OT"
                else:
                    last_game.score = f"{last_game.scoreA} - {last_game.scoreB} {last_game.overtime}OT"
        else:
            last_game.opponent = last_game.teamA
            last_game.result = last_game.resultB
            last_game.rank = last_game.rankATOG
            if not last_game.overtime:
                last_game.score = f"{last_game.scoreB} - {last_game.scoreA}"
            else:
                if last_game.overtime == 1:
                    last_game.score = f"{last_game.scoreB} - {last_game.scoreA} OT"
                else:
                    last_game.score = f"{last_game.scoreB} - {last_game.scoreA} {last_game.overtime}OT"
        return last_game
    else:
        return None


def get_next_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(
        year=info.currentYear, weekPlayed=info.currentWeek
    )
    games_as_teamB = team.games_as_teamB.filter(
        year=info.currentYear, weekPlayed=info.currentWeek
    )
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        next_game = schedule[-1]
        if next_game.teamA == team:
            next_game.opponent = next_game.teamB
            next_game.rank = next_game.teamB.ranking
            next_game.spread = next_game.spreadA
        else:
            next_game.opponent = next_game.teamA
            next_game.rank = next_game.teamA.ranking
            next_game.spread = next_game.spreadB

        return next_game
    else:
        return None


@api_view(["GET"])
def rankings(request):
    """API endpoint for rankings data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    teams = Teams.objects.filter(info=info).order_by("ranking")
    
    # Process team data with last/next game info
    rankings_data = []
    for t in teams:
        last_game = get_last_game(info, t)
        next_game = get_next_game(info, t)
        
        team_data = {
            'name': t.name,
            'ranking': t.ranking,
            'record': f"{t.totalWins}-{t.totalLosses} ({t.confWins}-{t.confLosses})",
            'movement': t.last_rank - t.ranking if t.last_rank else 0
        }
            
        # Add last game info if exists
        if last_game:
            team_data['last_game'] = {
                'opponent': {
                    'name': last_game.opponent.name,
                    'ranking': last_game.rank
                },
                'result': last_game.result,
                'score': last_game.score
            }
            
        # Add next game info if exists
        if next_game:
            team_data['next_game'] = {
                'opponent': {
                    'name': next_game.opponent.name,
                    'ranking': next_game.rank
                },
                'spread': next_game.spread
            }
            
        rankings_data.append(team_data)

    return Response({
        'info': InfoSerializer(info).data,
        'rankings': rankings_data,
        'conferences': ConferenceNameSerializer(
            info.conferences.all().order_by("confName"), 
            many=True
        ).data,
    })


def game(request, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    game = info.games.get(id=id)

    if game.winner:
        return game_result(request, info, game)
    else:
        return game_preview(request, info, game)


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



@api_view(["GET"])
def playoff(request):
    """API endpoint for playoff projection data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    
    # Get playoff teams ordered by seed
    playoff_teams = info.teams.filter(seed__isnull=False).order_by('seed')
    
    # Get bubble teams (next 5 teams after playoff teams by ranking)
    playoff_team_ids = playoff_teams.values_list('id', flat=True)
    bubble_teams = info.teams.exclude(id__in=playoff_team_ids).order_by('ranking')[:5]
    
    # Get conference champions
    conference_champions = []
    for conf in info.conferences.all():
        champion = conf.teams.order_by('-confWins', '-resume', 'ranking').first()
        if champion:
            conference_champions.append(champion)
    
    # Process playoff teams data
    playoff_data = []
    for team in playoff_teams:
        team_data = {
            'name': team.name,
            'seed': team.seed,
            'ranking': team.ranking,
            'conference': team.conference.confName if team.conference else None
        }
        playoff_data.append(team_data)
        
    # Process bubble teams data
    bubble_data = []
    for team in bubble_teams:
        team_data = {
            'name': team.name,
            'ranking': team.ranking,
            'conference': team.conference.confName if team.conference else 'Independent'
        }
        bubble_data.append(team_data)
        
    # Process conference champions data
    champion_data = []
    for team in conference_champions:
        team_data = {
            'name': team.name,
            'ranking': team.ranking,
            'conference': team.conference.confName,
            'seed': team.seed if hasattr(team, 'seed') else None
        }
        champion_data.append(team_data)

    return Response({
        'info': InfoSerializer(info).data,
        'team': TeamsSerializer(info.team).data,
        'playoff_teams': playoff_data,
        'bubble_teams': bubble_data,
        'conference_champions': champion_data,
        'conferences': ConferenceNameSerializer(
            info.conferences.all().order_by("confName"), 
            many=True
        ).data,
    })


@api_view(["GET"])
def standings(request, conference_name):
    """API endpoint for conference standings data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    if conference_name != "independent":
        # Get conference standings
        conference = info.conferences.get(confName=conference_name)
        teams = list(conference.teams.all())

        # Calculate conference winning percentage and sort teams
        teams_data = []
        for team in teams:
            conf_games = team.confWins + team.confLosses
            pct = team.confWins / conf_games if conf_games > 0 else 0
            
            # Get last and next game info
            last_game = get_last_game(info, team)
            next_game = get_next_game(info, team)
            
            team_data = {
                'name': team.name,
                'ranking': team.ranking,
                'confWins': team.confWins,
                'confLosses': team.confLosses,
                'totalWins': team.totalWins,
                'totalLosses': team.totalLosses,
                'pct': round(pct, 3),
                'rating': team.rating
            }
            
            # Add last game info if exists
            if last_game:
                team_data['last_game'] = {
                    'opponent': {
                        'name': last_game.opponent.name,
                        'ranking': last_game.rank
                    },
                    'result': last_game.result,
                    'score': last_game.score
                }
                
            # Add next game info if exists
            if next_game:
                team_data['next_game'] = {
                    'opponent': {
                        'name': next_game.opponent.name,
                        'ranking': next_game.rank
                    },
                    'spread': next_game.spread
                }
            
            teams_data.append(team_data)

        # Sort by conference winning percentage, then wins, then losses, then ranking
        teams_data.sort(key=lambda x: (-x['pct'], -x['confWins'], x['confLosses'], x['ranking']))

        return Response({
            'info': InfoSerializer(info).data,
            'team': TeamsSerializer(info.team).data,
            'conference': conference.confName,
            'teams': teams_data,
            'conferences': ConferenceNameSerializer(
                info.conferences.all().order_by("confName"),
                many=True
            ).data,
        })
    else:
        # Get independent teams standings
        independent_teams = info.teams.filter(conference=None).order_by('-totalWins', '-resume', 'ranking')
        
        teams_data = []
        for team in independent_teams:
            # Get last and next game info
            last_game = get_last_game(info, team)
            next_game = get_next_game(info, team)
            
            team_data = {
                'name': team.name,
                'ranking': team.ranking,
                'totalWins': team.totalWins,
                'totalLosses': team.totalLosses,
                'rating': team.rating
            }
            
            # Add last game info if exists
            if last_game:
                team_data['last_game'] = {
                    'opponent': {
                        'name': last_game.opponent.name,
                        'ranking': last_game.rank
                    },
                    'result': last_game.result,
                    'score': last_game.score
                }
                
            # Add next game info if exists
            if next_game:
                team_data['next_game'] = {
                    'opponent': {
                        'name': next_game.opponent.name,
                        'ranking': next_game.rank
                    },
                    'spread': next_game.spread
                }
            
            teams_data.append(team_data)

        return Response({
            'info': InfoSerializer(info).data,
            'team': TeamsSerializer(info.team).data,
            'teams': teams_data,
            'conferences': ConferenceNameSerializer(
                info.conferences.all().order_by("confName"),
                many=True
            ).data,
        })
    
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
                'id': player.id,
                'first': player.first,
                'last': player.last,
                'pos': player.pos,
                'year': player.year,
                'rating': player.rating,
                'starter': player.starter
            }
            roster_data.append(player_data)

    return Response({
        'info': InfoSerializer(info).data,
        'team': TeamsSerializer(team).data,
        'roster': roster_data,
        'positions': positions,
        'conferences': ConferenceNameSerializer(
            info.conferences.all().order_by("confName"),
            many=True
        ).data,
        'teams': TeamBasicSerializer(
            info.teams.all().order_by('name'),
            many=True
        ).data,
    })

@api_view(["GET"])
def history(request, team_name):
    """API endpoint for team history data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.teams.get(name=team_name)

    # Get years data and process it
    years_data = []
    for year in team.years.order_by("-year"):
        years_data.append({
            'year': year.year,
            'prestige': year.prestige,
            'rating': year.rating,
            'conference': year.conference,
            'wins': year.wins,
            'losses': year.losses,
            'rank': year.rank
        })

    return Response({
        'info': InfoSerializer(info).data,
        'team': TeamsSerializer(team).data,
        'years': years_data,
        'conferences': ConferenceNameSerializer(
            info.conferences.all().order_by("confName"),
            many=True
        ).data,
        'teams': TeamBasicSerializer(
            info.teams.all().order_by('name'),
            many=True
        ).data,
    })