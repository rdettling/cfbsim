from ..models import *
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
from logic.util import get_schedule_game
from logic.roster_management import progress_ratings
import uuid
from logic.season import (
    transition_rosters,
    update_history,
    realignment_summary,
    init,
    transition_season_data,
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
            "realignment": realignment_summary(info),
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def roster_progression(request):
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Only update stage when transitioning from summary to progression
    if info.stage == "summary":
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
            "conferences": ConferenceNameSerializer(
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
        # Part 1: Remove seniors, progress players, and add freshmen
        transition_rosters(info)

        info.stage = "recruiting_summary"
        info.save()

    # Get all freshmen players (new recruits) from the current season
    freshmen = info.players.filter(year="fr").select_related("team", "team__conference")

    # Group freshmen by team
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

    # Sort teams by prestige (highest first)
    sorted_teams = sorted(
        freshmen_by_team.items(), key=lambda x: x[1]["team"]["prestige"], reverse=True
    )

    # Calculate summary stats
    total_freshmen = len(freshmen)
    avg_rating = (
        sum(player.rating for player in freshmen) / total_freshmen
        if total_freshmen > 0
        else 0
    )
    max_rating = max(player.rating for player in freshmen) if total_freshmen > 0 else 0
    min_rating = min(player.rating for player in freshmen) if total_freshmen > 0 else 0

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "freshmen_by_team": dict(sorted_teams),
            "summary_stats": {
                "total_freshmen": total_freshmen,
                "avg_rating": round(avg_rating, 1),
                "max_rating": max_rating,
                "min_rating": min_rating,
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
        )

    else:
        info = Info.objects.get(user_id=user_id)

        if info.stage == "recruiting_summary":
            # Part 2: Handle realignment and game refresh
            info.stage = "preseason"
            info.currentYear += 1
            info.currentWeek = 1

            transition_season_data(info)
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
