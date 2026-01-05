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

    if info.stage == "summary":
        finalize_awards(info)
    else:
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

    if info.stage == "summary":
        finalize_awards(info)

    races = Award.objects.filter(info=info, is_final=True).select_related(
        "first_place", "second_place", "third_place"
    )

    return Response({"final": AwardSerializer(races, many=True).data})
