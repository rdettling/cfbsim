import json
from ..models import *
from logic.season import start_season
import os
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.util import (
    get_last_game,
    get_next_game,
    sort_standings,
    load_year_data,
)


@api_view(["GET"])
def home(request):
    """API endpoint for the launch page data"""
    user_id = request.headers.get("X-User-ID")
    year = request.GET.get("year")

    # Get user info if it exists
    info_data = None
    try:
        if user_id:
            info = Info.objects.get(user_id=user_id)
            info_data = InfoSerializer(info).data
    except Info.DoesNotExist:
        pass

    # Get available years - only once, regardless of 'year' parameter
    years = [
        f.split(".")[0]
        for f in os.listdir(settings.YEARS_DATA_DIR)
        if f.endswith(".json")
    ]
    years.sort(reverse=True)

    # Get preview data for the selected year or first year if none provided
    preview_data = None
    preview_year = year or (years[0] if years else None)

    if preview_year:
        try:
            # Load data using utility function
            preview_data = load_year_data(preview_year)

            # Sort teams by prestige within each conference
            for conf_name, conf_data in preview_data["conferences"].items():
                conf_data["teams"] = sorted(
                    conf_data["teams"], key=lambda team: team["prestige"], reverse=True
                )
        except (FileNotFoundError, IOError) as e:
            print(f"Error loading preview data for year {preview_year}: {e}")

    return Response(
        {
            "info": info_data,
            "years": years,
            "preview": preview_data,
            "selected_year": preview_year,  # Return the year that was actually used
        }
    )


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

    # Check if the current week game has been played (via live sim or regular sim)
    # If so, treat it as the "last game" and clear "next game"
    if next_game and next_game.get("winner"):
        last_game = next_game
        next_game = None

    # Get conference teams or independent teams based on team's status
    if team.conference:
        # Get teams and use the sort_standings function for consistent sorting
        conf_teams = list(team.conference.teams.all())
        conf_teams = sort_standings(conf_teams)
        related_teams = TeamsSerializer(conf_teams, many=True).data
    else:
        # For independent teams, get other independents and sort them too
        independent_teams = list(info.teams.filter(conference=None).exclude(id=team.id))
        independent_teams = sort_standings(independent_teams)
        related_teams = TeamsSerializer(independent_teams, many=True).data

    # Get top 10 watchability games from last week
    top_games = []
    if info.currentWeek > 1:
        last_week_games = info.games.filter(
            year=info.currentYear,
            weekPlayed=info.currentWeek - 1,
            winner__isnull=False,  # Only completed games
        ).order_by("-watchability")[:10]

        top_games = [
            {"id": game.id, "headline": game.headline} for game in last_week_games
        ]

    return Response(
        {
            "info": InfoSerializer(info).data,
            "prev_game": last_game,
            "curr_game": next_game,
            "team": TeamsSerializer(team).data,
            "confTeams": related_teams,
            "top_10": TeamsSerializer(
                info.teams.order_by("ranking")[:10], many=True
            ).data,
            "top_games": top_games,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )
