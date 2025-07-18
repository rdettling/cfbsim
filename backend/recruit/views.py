from django.http import JsonResponse
from django.shortcuts import render
from django.db.models import Prefetch, Exists, OuterRef
from start.models import *


def recruiting(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    recruits_with_offers = info.recruits.annotate(
        has_offer_from_info_team=Exists(
            Offers.objects.filter(
                recruit_id=OuterRef("id"),
                info=info,
                team=info.team,
            )
        )
    ).prefetch_related(
        Prefetch(
            "offers",
            queryset=Offers.objects.filter(info=info).order_by("-interest_level")[:3],
            to_attr="top_three_offers",
        )
    )

    # Extract unique states, positions, and star counts
    unique_states = recruits_with_offers.values_list("state", flat=True).distinct()
    stars = recruits_with_offers.values_list("stars", flat=True).distinct()

    positions = ["qb", "rb", "wr", "te", "ol", "dl", "lb", "cb", "s", "k", "p"]

    context = {
        "info": info,
        "recruits": recruits_with_offers,
        "states": sorted(unique_states),
        "positions": positions,
        "stars": stars,
        "weeks": [i for i in range(1, info.lastWeek + 1)],
    }

    return render(request, "recruiting.html", context)


def offer(request, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.team
    recruit = info.recruits.get(id=id)
    Offers.objects.create(info=info, team=team, recruit=recruit)
    team.offers -= 1
    team.save()

    return JsonResponse({"message": "Offer made successfully!"})


def points(request, id):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    points = 100

    team = info.team
    recruit = info.recruits.get(id=id)
    offer = recruit.offers.get(team=team)
    offer.interest_level += points
    offer.save()

    team.recruiting_points -= points
    team.save()

    return JsonResponse({"message": "points added!"})
