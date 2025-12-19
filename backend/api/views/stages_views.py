from ..models import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.util import get_schedule_game, calculate_recruiting_rankings
from logic.roster_management import progress_ratings
import uuid
from logic.season import (
    transition_rosters,
    update_history,
    get_next_season_preview,
    init,
    apply_realignment_and_playoff,
    refresh_season_data,
)


@api_view(["GET"])
def season_summary(request):
    """API endpoint for season summary data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    if info.stage == "season":
        update_history(info)
        info.stage = "summary"
        info.save()

    return Response(
        {
            "team": TeamsSerializer(info.team).data,
            "info": InfoSerializer(info).data,
            "champion": TeamsSerializer(info.playoff.natty.winner).data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def realignment_view(request):
    """API endpoint for realignment stage"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Transition from summary to realignment stage
    if info.stage == "summary":
        info.stage = "realignment"
        info.save()

    # Get next season preview (realignment and playoff changes)
    realignment_changes, playoff_changes = get_next_season_preview(info)

    return Response(
        {
            "team": TeamsSerializer(info.team).data,
            "info": InfoSerializer(info).data,
            "settings": SettingsSerializer(info.settings).data,
            "realignment": realignment_changes,
            "playoff_changes": playoff_changes,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["PUT"])
def update_realignment_settings(request):
    """API endpoint to update realignment settings"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    try:
        settings = info.settings
    except Settings.DoesNotExist:
        settings = Settings.objects.create(info=info)

    # Update settings from request data
    data = request.data.copy()
    
    # Ensure proper values for 2 or 4 team playoffs
    playoff_teams = data.get('playoff_teams', settings.playoff_teams)
    if playoff_teams in [2, 4]:
        data['playoff_autobids'] = 0
        data['playoff_conf_champ_top_4'] = False
    
    serializer = SettingsSerializer(settings, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


@api_view(["GET"])
def roster_progression(request):
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Transition from realignment to progression stage
    # Apply realignment and playoff changes (increments year)
    if info.stage == "realignment":
        apply_realignment_and_playoff(info)
        info.stage = "progression"
        info.save()

    # Always calculate changes without actually progressing players
    progressed = progress_ratings(info)

    return Response(
        {
            "team": TeamsSerializer(info.team).data,
            "info": InfoSerializer(info).data,
            "progressed": PlayersSerializer(progressed, many=True).data,
            "leaving": PlayersSerializer(
                info.team.players.filter(year="sr", active=True), many=True
            ).data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def recruiting_summary(request):
    """API endpoint for recruiting summary data"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Transition from progression to recruiting_summary stage
    if info.stage == "progression":
        transition_rosters(info)
        info.stage = "recruiting_summary"
        info.save()

    # Get all freshmen players and group by team
    freshmen = info.players.filter(year="fr").select_related("team", "team__conference")
    freshmen_by_team = {}

    for player in freshmen:
        team_name = player.team.name
        if team_name not in freshmen_by_team:
            freshmen_by_team[team_name] = {
                "team": TeamsSerializer(player.team).data,
                "players": [],
            }
        freshmen_by_team[team_name]["players"].append(
            {
                "id": player.id,
                "first": player.first,
                "last": player.last,
                "pos": player.pos,
                "rating": player.rating,
                "stars": player.stars,
                "development_trait": player.development_trait,
            }
        )

    # Calculate team recruiting rankings
    team_rankings = calculate_recruiting_rankings(freshmen_by_team)

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "team_rankings": team_rankings,
            "summary_stats": {
                "total_freshmen": len(freshmen),
                "avg_rating": (
                    round(sum(player.rating for player in freshmen) / len(freshmen), 1)
                    if freshmen
                    else 0
                ),
                "max_rating": (
                    max(player.rating for player in freshmen) if freshmen else 0
                ),
                "min_rating": (
                    min(player.rating for player in freshmen) if freshmen else 0
                ),
            },
        }
    )


@api_view(["GET"])
def noncon(request):
    """API endpoint for non-conference scheduling page"""
    user_id = request.headers.get("X-User-ID")
    team = request.GET.get("team")
    year = request.GET.get("year")
    playoff_teams = request.GET.get("playoff_teams")
    playoff_autobids = request.GET.get("playoff_autobids")
    playoff_conf_champ_top_4 = request.GET.get("playoff_conf_champ_top_4")
    auto_realignment = request.GET.get("auto_realignment", "true").lower() == "true"
    auto_update_postseason_format = request.GET.get("auto_update_postseason_format", "true").lower() == "true"

    # Handle new game creation
    if team and year:
        user_id = str(uuid.uuid4())
        year = int(year)

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
            auto_realignment,
            auto_update_postseason_format,
        )

    else:
        info = Info.objects.get(user_id=user_id)
        
        # Transition from recruiting_summary to preseason
        if info.stage == "recruiting_summary":
            # Refresh season data (clear counters, plays, drives, init rankings, set rivalries)
            refresh_season_data(info)
            info.stage = "preseason"
            info.save()


    # Get team's schedule
    games = (
        info.team.games_as_teamA.filter(year=info.currentYear)
        | info.team.games_as_teamB.filter(year=info.currentYear)
    ).order_by("weekPlayed")

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

    return Response(response_data)
