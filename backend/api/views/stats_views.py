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
from django.db.models import Q, F, ExpressionWrapper, FloatField, Count, Avg
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
            "conferences": ConferencesSerializer(
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
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )


@api_view(["GET"])
def ratings_stats(request):
    """API endpoint for ratings and star distribution statistics by prestige tier"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)
    players = info.players.select_related("team").all()
    teams = info.teams.all()

    # Initialize data structures
    prestige_stats = {}
    team_counts = {}
    team_ratings = {}
    star_data = {
        star: {"count": 0, "fr": 0, "so": 0, "jr": 0, "sr": 0} for star in range(1, 6)
    }

    # Process players
    for player in players:
        prestige = player.team.prestige
        star = player.stars

        # Prestige stats
        if prestige not in prestige_stats:
            prestige_stats[prestige] = {
                "total_players": 0,
                "total_stars": 0,
                "star_counts": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            }
        prestige_stats[prestige]["total_players"] += 1
        prestige_stats[prestige]["total_stars"] += star
        prestige_stats[prestige]["star_counts"][star] += 1

        # Star rating data
        star_data[star]["count"] += 1
        star_data[star]["fr"] += player.rating_fr
        star_data[star]["so"] += player.rating_so
        star_data[star]["jr"] += player.rating_jr
        star_data[star]["sr"] += player.rating_sr

    # Process teams
    for team in teams:
        prestige = team.prestige
        team_counts[prestige] = team_counts.get(prestige, 0) + 1
        if prestige not in team_ratings:
            team_ratings[prestige] = {"total_rating": 0, "count": 0}
        team_ratings[prestige]["total_rating"] += team.rating
        team_ratings[prestige]["count"] += 1

    # Build prestige stars table
    prestige_stars_table = []
    for prestige in sorted(prestige_stats.keys()):
        stats = prestige_stats[prestige]
        if stats["total_players"] > 0:
            avg_team_rating = round(
                team_ratings[prestige]["total_rating"]
                / team_ratings[prestige]["count"],
                1,
            )
            avg_stars = round(stats["total_stars"] / stats["total_players"], 2)

            prestige_stars_table.append(
                {
                    "prestige": prestige,
                    "avg_rating": avg_team_rating,
                    "avg_stars": avg_stars,
                    "star_percentages": {
                        star: round(
                            (stats["star_counts"][star] / stats["total_players"]) * 100,
                            1,
                        )
                        for star in range(1, 6)
                    },
                }
            )

    # Calculate star averages
    def calculate_averages(star_data):
        return {
            star: {
                "count": data["count"],
                "avg_ratings": (
                    round(
                        (data["fr"] + data["so"] + data["jr"] + data["sr"])
                        / (data["count"] * 4),
                        1,
                    )
                    if data["count"] > 0
                    else 0
                ),
                "avg_ratings_fr": (
                    round(data["fr"] / data["count"], 1) if data["count"] > 0 else 0
                ),
                "avg_ratings_so": (
                    round(data["so"] / data["count"], 1) if data["count"] > 0 else 0
                ),
                "avg_ratings_jr": (
                    round(data["jr"] / data["count"], 1) if data["count"] > 0 else 0
                ),
                "avg_ratings_sr": (
                    round(data["sr"] / data["count"], 1) if data["count"] > 0 else 0
                ),
            }
            for star, data in star_data.items()
        }

    star_averages = calculate_averages(star_data)

    total_star_counts = {
        "counts": {star: data["count"] for star, data in star_averages.items()},
        "avg_ratings": {
            star: data["avg_ratings"] for star, data in star_averages.items()
        },
        "avg_ratings_fr": {
            star: data["avg_ratings_fr"] for star, data in star_averages.items()
        },
        "avg_ratings_so": {
            star: data["avg_ratings_so"] for star, data in star_averages.items()
        },
        "avg_ratings_jr": {
            star: data["avg_ratings_jr"] for star, data in star_averages.items()
        },
        "avg_ratings_sr": {
            star: data["avg_ratings_sr"] for star, data in star_averages.items()
        },
    }

    # Get teams sorted by rating (descending)
    teams_sorted = sorted(teams, key=lambda t: t.rating or 0, reverse=True)
    teams_data = [
        {"name": team.name, "prestige": team.prestige, "rating": team.rating or 0}
        for team in teams_sorted
    ]

    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "prestige_stars_table": prestige_stars_table,
            "total_star_counts": total_star_counts,
            "team_counts_by_prestige": [
                {"prestige": p, "team_count": c} for p, c in sorted(team_counts.items())
            ],
            "teams": teams_data,
            "conferences": ConferencesSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    )
