from django.http import JsonResponse
import json
from ..models import *
from django.db.models import F
from logic.season import *
import os
from django.conf import settings
from logic.sim.sim import DRIVES_PER_TEAM
from rest_framework.decorators import api_view
from rest_framework.response import Response
from ..serializers import *
import uuid
from django.db.models import Q, F, ExpressionWrapper, FloatField
from operator import attrgetter
from logic.stats import *
from logic.util import *
import time
from logic.sim.sim_helper import *



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