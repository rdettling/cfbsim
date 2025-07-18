from django.http import JsonResponse
from ..models import *
from django.db.models import F
from logic.season import init, next_season, scheduleGame
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
import uuid
from logic.util import get_schedule_game


@api_view(["GET"])
def noncon(request):
    """API endpoint for non-conference scheduling page"""
    user_id = request.headers.get("X-User-ID")
    team = request.GET.get("team")
    year = request.GET.get("year")
    playoff_teams = request.GET.get("playoff_teams")
    playoff_autobids = request.GET.get("playoff_autobids")
    playoff_conf_champ_top_4 = request.GET.get("playoff_conf_champ_top_4")

    print(
        f"[DEBUG] noncon API called with: user_id={user_id}, team={team}, year={year}, playoff_teams={playoff_teams}"
    )

    # Handle new game creation
    if team and year:
        try:
            print(f"[DEBUG] Creating new game for team: {team}, year: {year}")
            user_id = str(uuid.uuid4())
            print(f"[DEBUG] Generated new user_id: {user_id}")

            # Convert playoff parameters to appropriate types
            playoff_teams_int = int(playoff_teams) if playoff_teams else None
            playoff_autobids_int = int(playoff_autobids) if playoff_autobids else None
            playoff_conf_champ_top_4_bool = (
                playoff_conf_champ_top_4 == "true" if playoff_conf_champ_top_4 else None
            )

            info = init(
                user_id,
                team,
                year,
                playoff_teams_int,
                playoff_autobids_int,
                playoff_conf_champ_top_4_bool,
            )
            print(f"[DEBUG] Game initialized successfully, team: {team}, year: {year}")
        except Exception as e:
            print(f"[ERROR] Failed to initialize game: {str(e)}")
            import traceback

            print(traceback.format_exc())
            return Response(
                {
                    "error": f"Failed to initialize game: {str(e)}",
                    "details": traceback.format_exc(),
                },
                status=500,
            )
    else:
        try:
            print(f"[DEBUG] Loading existing game for user_id: {user_id}")
            info = Info.objects.get(user_id=user_id)
            print(f"[DEBUG] Found info for user_id: {user_id}, team: {info.team.name}")

            if info.stage == "progression":
                print(f"[DEBUG] Stage is progression, running next_season()")
                next_season(info)
                info.stage = "preseason"
                info.save()
                print(f"[DEBUG] Updated stage to preseason")
        except Info.DoesNotExist:
            print(f"[ERROR] Info not found for user_id: {user_id}")
            return Response(
                {"error": "Session expired. Please start a new game.", "redirect": "/"},
                status=400,
            )
        except Exception as e:
            print(f"[ERROR] Error loading existing game: {str(e)}")
            import traceback

            print(traceback.format_exc())
            return Response(
                {
                    "error": f"Error loading existing game: {str(e)}",
                    "details": traceback.format_exc(),
                },
                status=500,
            )

    try:
        # Get team's schedule
        print(f"[DEBUG] Getting schedule for team: {info.team.name}")
        games = (
            info.team.games_as_teamA.filter(year=info.currentYear)
            | info.team.games_as_teamB.filter(year=info.currentYear)
        ).order_by("weekPlayed")

        print(f"[DEBUG] Found {games.count()} games for team: {info.team.name}")

        # Build schedule with empty weeks where no game is scheduled
        schedule = [
            (
                get_schedule_game(info.team, games_by_week[week])
                if week in games_by_week
                else {"weekPlayed": week, "opponent": None}
            )
            for week in range(1, 13)
            for games_by_week in [{game.weekPlayed: game for game in games}]
        ]

        response_data = {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "schedule": schedule,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }

        # Add user_id to response only for new games
        if team and year:
            response_data["user_id"] = user_id
            print(f"[DEBUG] Added user_id to response for new game: {user_id}")

        print(f"[DEBUG] Successfully prepared response data")
        return Response(response_data)

    except Exception as e:
        print(f"[ERROR] Error building response: {str(e)}")
        import traceback

        print(traceback.format_exc())
        return Response(
            {
                "error": f"Error building response: {str(e)}",
                "details": traceback.format_exc(),
            },
            status=500,
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
