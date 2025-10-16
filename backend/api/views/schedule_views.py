from django.http import JsonResponse
from ..models import *
from django.db.models import F
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.schedule import scheduleGame


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

    # Get games for the specified week, ordered by watchability (highest first)
    games = info.games.filter(year=info.currentYear, weekPlayed=week_num).order_by('-watchability')

    # Process games data
    games_data = GamesSerializer(games, many=True).data

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "games": games_data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )
