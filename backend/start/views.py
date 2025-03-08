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
from util.util import *
from django.db.models import Q, F, ExpressionWrapper, FloatField
from operator import attrgetter
from logic.stats import *


def get_schedule_game(team, game):
    is_team_a = game.teamA == team
    opponent = game.teamB if is_team_a else game.teamA

    # Construct the label
    if game.name:
        label = game.name
    else:
        conf_match = (
            team.conference == opponent.conference
            if team.conference and opponent.conference
            else False
        )
        label = (
            f"C ({team.conference.confName})"
            if conf_match
            else (
                f"NC ({opponent.conference.confName})"
                if opponent.conference
                else "NC (Ind)"
            )
        )

    return {
        "id": game.id,
        "weekPlayed": game.weekPlayed,
        "opponent": {
            "name": opponent.name,
            "ranking": opponent.ranking,
            "rating": opponent.rating,
            "record": format_record(opponent),
        },
        "label": label,
        "result": game.resultA if is_team_a else game.resultB,
        "spread": game.spreadA if is_team_a else game.spreadB,
        "moneyline": game.moneylineA if is_team_a else game.moneylineB,
        "score": (
            (
                f"{game.scoreA}-{game.scoreB}"
                if is_team_a
                else f"{game.scoreB}-{game.scoreA}"
            )
            if game.winner
            else None
        ),
    }


def get_last_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(
        year=info.currentYear, weekPlayed=info.currentWeek - 1
    )
    games_as_teamB = team.games_as_teamB.filter(
        year=info.currentYear, weekPlayed=info.currentWeek - 1
    )
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        return get_schedule_game(team, schedule[-1])
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
        return get_schedule_game(team, schedule[0])
    else:
        return None


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
    replace = False

    if team and year:
        user_id = str(uuid.uuid4())
        replace = True
        init(user_id, team, year)

    info = Info.objects.get(user_id=user_id)
    team = info.team

    # Get team's games
    games = (
        team.games_as_teamA.filter(year=info.currentYear)
        | team.games_as_teamB.filter(year=info.currentYear)
    ).order_by("weekPlayed")

    # Process games into schedule format
    schedule = []
    games_by_week = {game.weekPlayed: game for game in games}

    # Build full schedule with empty weeks where no game is scheduled
    for week in range(1, 13):
        if week in games_by_week:
            game = games_by_week[week]
            schedule.append(get_schedule_game(team, game))
        else:
            schedule.append(
                {
                    "weekPlayed": week,
                    "opponent": None,
                }
            )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(team).data,
            "schedule": schedule,
            "user_id": user_id,
            "replace": replace,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
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
    """API endpoint for dashboard data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    team = info.team

    if not info.stage == "season":
        start_season(info)

    last_game = get_last_game(info, team)
    next_game = get_next_game(info, team)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "prev_game": last_game,
            "curr_game": next_game,
            "team": TeamsSerializer(team).data,
            "confTeams": TeamsSerializer(team.conference.teams.all(), many=True).data,
            "top_10": TeamsSerializer(
                info.teams.order_by("ranking")[:10], many=True
            ).data,
            "conferences": ConferenceNameSerializer(
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
        list(games_as_teamA | games_as_teamB), key=lambda game: game.weekPlayed
    )

    processed_schedule = [get_schedule_game(team, game) for game in schedule]

    years = list(range(info.currentYear, info.startYear - 1, -1))

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(team).data,
            "games": processed_schedule,
            "years": years,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "teams": TeamNameSerializer(
                info.teams.all().order_by("name"), many=True
            ).data,
        }
    )


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
            "name": t.name,
            "ranking": t.ranking,
            "record": format_record(t),
            "movement": t.last_rank - t.ranking if t.last_rank else 0,
            "last_game": last_game,
            "next_game": next_game,
        }

        rankings_data.append(team_data)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "rankings": rankings_data,
            "team": TeamsSerializer(info.team).data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


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


@api_view(["GET"])
def simWeek(request):
    """API endpoint for simulating a week of games"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    games = info.games.filter(year=info.currentYear, weekPlayed=info.currentWeek)
    team = info.team

    drives_to_create = []
    plays_to_create = []
    teamGames = []
    teamGame = None

    # Simulate all games for the week
    for game in games:
        if (game.teamA == team or game.teamB == team):
            teamGame = game
            teamGames.append(game)

        simGame(game, info, drives_to_create, plays_to_create)

    # Bulk update game results
    Games.objects.bulk_update(
        games, ["scoreA", "scoreB", "winner", "resultA", "resultB", "overtime"]
    )

    # Update rankings if needed
    update_rankings_exceptions = {4: [14], 12: [14, 15, 16]}
    no_update_weeks = update_rankings_exceptions.get(info.playoff.teams, [])

    if info.currentWeek not in no_update_weeks:
        update_rankings(info)

    # Handle special weeks (conference championships, playoffs, etc.)
    all_actions = {
        2: {
            12: setConferenceChampionships,
            13: setNatty,
        },
        4: {
            12: setConferenceChampionships,
            13: setPlayoffSemi,
            14: setNatty,
        },
        12: {
            12: setConferenceChampionships,
            13: setPlayoffR1,
            14: setPlayoffQuarter,
            15: setPlayoffSemi,
            16: setNatty
        },
    }

    action = all_actions.get(info.playoff.teams, {}).get(info.currentWeek)
    if action:
        action(info)

    # if info.currentWeek == info.lastWeek:
    #     end_season(info)

    # Increment week and save data
    info.currentWeek += 1
    make_game_logs(info, plays_to_create)
    Drives.objects.bulk_create(drives_to_create)
    Plays.objects.bulk_create(plays_to_create)
    info.save()

    # Return updated data
    return Response({
        "status": "success",
        "info": InfoSerializer(info).data,
        "team": TeamsSerializer(team).data,
        "teamGame": GamesSerializer(teamGame).data if teamGame else None,
        "conferences": ConferenceNameSerializer(
            info.conferences.all().order_by("confName"), many=True
        ).data,
    })


@api_view(["GET"])
def game(request, id):
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    game = info.games.get(id=id)

    if game.winner:
        return game_result(info, game)
    else:
        return game_preview(info, game)


def game_preview(info, game):
    """API endpoint for game preview data"""
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

    # Process player data
    top_players = [[], []]  # Two arrays: one for teamA, one for teamB
    for player_a in top_players_a:
        if player_a:
            top_players[0].append(
                {
                    "id": player_a.id,
                    "first": player_a.first,
                    "last": player_a.last,
                    "pos": player_a.pos,
                    "rating": player_a.rating,
                }
            )

    for player_b in top_players_b:
        if player_b:
            top_players[1].append(
                {
                    "id": player_b.id,
                    "first": player_b.first,
                    "last": player_b.last,
                    "pos": player_b.pos,
                    "rating": player_b.rating,
                }
            )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "game": GamesSerializer(game).data,
            "top_players": top_players,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


def game_result(info, game):
    """API endpoint for game result data"""
    drives = game.drives.all()
    game_logs = game.game_logs.all()

    # Process game logs by category
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

    # Process drives data
    drives_data = []
    for drive in drives:
        drives_data.append(
            {
                "offense": drive.offense.name,
                "result": drive.result,
                "points": drive.points,
                "scoreAAfter": drive.scoreAAfter,
                "scoreBAfter": drive.scoreBAfter,
            }
        )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "game": GamesSerializer(game).data,
            "drives": drives_data,
            "stats": game_stats(game),
            "game_logs": categorized_game_log_strings,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


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
def standings(request, conference_name):
    """API endpoint for conference standings data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    
    def process_team(team):
        return {
            "name": team.name,
            "ranking": team.ranking,
            "confWins": team.confWins,
            "confLosses": team.confLosses,
            "totalWins": team.totalWins,
            "totalLosses": team.totalLosses,
            "rating": team.rating,
            "last_game": get_last_game(info, team),
            "next_game": get_next_game(info, team),
        }

    if conference_name != "independent":
        conference = info.conferences.get(confName=conference_name)
        teams = list(conference.teams.all())
        
        # Sort by conference win percentage, wins, losses, then ranking
        teams.sort(key=lambda t: (
            -t.confWins / (t.confWins + t.confLosses) if (t.confWins + t.confLosses) > 0 else 0,
            -t.confWins,
            t.confLosses,
            t.ranking
        ))
        
        return Response({
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "conference": conference.confName,
            "teams": [process_team(team) for team in teams],
            "conferences": ConferenceNameSerializer(info.conferences.all().order_by("confName"), many=True).data,
        })
    else:
        independent_teams = info.teams.filter(conference=None).order_by("-totalWins", "-resume", "ranking")
        return Response({
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "teams": [process_team(team) for team in independent_teams],
            "conferences": ConferenceNameSerializer(info.conferences.all().order_by("confName"), many=True).data,
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
            player.pos,
            gl,
            get_schedule_game(team, gl.game)
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
def week_schedule(request, week_num):
    """API endpoint for week schedule data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Get games for the specified week
    games = info.games.filter(year=info.currentYear, weekPlayed=week_num).order_by(
        (F("teamA__ranking") + F("teamB__ranking")) / 2
    )

    # Process games data
    games_data = GamesSerializer(games, many=True).data

    # Add game of week flag to first game
    if games_data:
        games_data[0]["game_of_week"] = True

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "games": games_data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def playoff(request):
    """API endpoint for playoff projection data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Get the number of autobids
    autobids = info.playoff.autobids

    # Get conference champions or top teams from each conference
    conference_champions = []
    for conference in info.conferences.all():
        if conference.championship and conference.championship.winner:
            conference_champions.append(conference.championship.winner)
        else:
            conf_teams = conference.teams.annotate(
                win_percentage=ExpressionWrapper(
                    F("confWins") * 1.0 / (F("confWins") + F("confLosses")),
                    output_field=FloatField(),
                )
            ).order_by("-win_percentage", "-confWins", "ranking", "-totalWins")
            if conf_teams.exists():
                conference_champions.append(conf_teams.first())

    # Sort conference champions by ranking
    conference_champions.sort(key=attrgetter("ranking"))

    # Get the top 4 seeds (conference champions from different conferences)
    top_4_seeds = []
    seen_conferences = set()
    for team in conference_champions:
        if team.conference.confName not in seen_conferences:
            top_4_seeds.append(team)
            seen_conferences.add(team.conference.confName)
        if len(top_4_seeds) == 4:
            break

    # Get the remaining autobid teams
    remaining_autobids = conference_champions[len(top_4_seeds) : autobids]

    # Get all other teams (excluding all autobid teams)
    other_teams = (
        Teams.objects.filter(info=info)
        .exclude(id__in=[team.id for team in top_4_seeds + remaining_autobids])
        .order_by("ranking")
    )

    # Select the remaining at-large teams
    at_large_teams = list(other_teams)[: 8 - len(remaining_autobids)]

    # Get the bubble teams (5 highest ranked at-large teams that didn't make it)
    bubble_teams = list(other_teams)[len(at_large_teams) : len(at_large_teams) + 5]

    # Combine all teams and sort by ranking (except top 4)
    playoff_teams = top_4_seeds + sorted(
        remaining_autobids + at_large_teams, key=attrgetter("ranking")
    )

    # Process playoff teams data
    playoff_data = [
        {
            "name": team.name,
            "seed": i + 1,
            "ranking": team.ranking,
            "conference": team.conference.confName if team.conference else None,
            "record": format_record(team),
            "is_autobid": team in (top_4_seeds + remaining_autobids),
        }
        for i, team in enumerate(playoff_teams)
    ]

    # Process bubble teams data
    bubble_data = [
        {
            "name": team.name,
            "ranking": team.ranking,
            "conference": (
                team.conference.confName if team.conference else "Independent"
            ),
            "record": format_record(team),
        }
        for team in bubble_teams
    ]

    # Process conference champions data
    champion_data = [
        {
            "name": team.name,
            "ranking": team.ranking,
            "conference": team.conference.confName,
            "record": format_record(team),
            "seed": next(
                (pt["seed"] for pt in playoff_data if pt["name"] == team.name), None
            ),
        }
        for team in sorted(conference_champions, key=attrgetter("ranking"))
    ]

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "playoff_teams": playoff_data,
            "bubble_teams": bubble_data,
            "conference_champions": champion_data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def team_stats(request):
    """API endpoint for team stats data"""
    user_id = request.headers.get("X-User-ID")
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

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "offense": offense,
            "defense": defense,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def individual_stats(request):
    """API endpoint for individual stats data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Process each category's stats
    def process_stats(stats_dict):
        processed_stats = {}
        for player, stats in stats_dict.items():
            processed_stats[str(player.id)] = {
                "id": player.id,
                "first": player.first,
                "last": player.last,
                "pos": player.pos,
                "team": player.team.name,
                "gamesPlayed": player.team.gamesPlayed,
                "stats": stats,
            }
        return processed_stats

    # Get stats for all categories using existing function
    passing_stats = process_stats(accumulate_individual_stats(info, "passing"))
    rushing_stats = process_stats(accumulate_individual_stats(info, "rushing"))
    receiving_stats = process_stats(accumulate_individual_stats(info, "receiving"))

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "stats": {
                "passing": passing_stats,
                "rushing": rushing_stats,
                "receiving": receiving_stats,
            },
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )
