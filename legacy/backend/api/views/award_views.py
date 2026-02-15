from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Info, Award
from ..serializers import (
    AwardSerializer,
    InfoSerializer,
    TeamsSerializer,
    ConferencesSerializer,
)
from logic.awards import (
    refresh_award_favorites,
    finalize_awards,
)


@api_view(["GET"])
def awards(request):
    """Return award favorites mid-season and finalized winners when available."""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    def awards_up_to_date(is_final):
        return Award.objects.filter(
            info=info,
            is_final=is_final,
            calculated_year=info.currentYear,
            calculated_week=info.currentWeek,
        ).exists()

    if info.stage == "summary":
        if not awards_up_to_date(is_final=True):
            finalize_awards(info)
    else:
        if not awards_up_to_date(is_final=False):
            refresh_award_favorites(info)

    favorites = Award.objects.filter(info=info, is_final=False).select_related(
        "first_place", "second_place", "third_place"
    )
    final = Award.objects.filter(info=info, is_final=True).select_related(
        "first_place", "second_place", "third_place"
    )

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
            "favorites": AwardSerializer(favorites, many=True).data,
            "final": AwardSerializer(final, many=True).data,
        }
    )


@api_view(["GET"])
def awards_status(request):
    """Minimal endpoint if only final status data is needed."""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    def final_awards_up_to_date():
        return Award.objects.filter(
            info=info,
            is_final=True,
            calculated_year=info.currentYear,
            calculated_week=info.currentWeek,
        ).exists()

    if info.stage == "summary" and not final_awards_up_to_date():
        finalize_awards(info)

    races = Award.objects.filter(info=info, is_final=True).select_related(
        "first_place", "second_place", "third_place"
    )

    return Response({"final": AwardSerializer(races, many=True).data})
