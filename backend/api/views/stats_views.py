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


@api_view(["GET"])
def ratings_stats(request):
    """API endpoint for ratings and star distribution statistics by prestige tier"""
    user_id = request.headers.get("X-User-ID")
    info = Info.objects.get(user_id=user_id)

    # Get all players with their team prestige
    players = info.players.select_related('team').all()
    teams = info.teams.all()
    
    # Group players by team prestige
    prestige_stats = {}
    team_counts = {}
    team_ratings = {}
    
    for player in players:
        prestige = player.team.prestige
        
        if prestige not in prestige_stats:
            prestige_stats[prestige] = {
                'total_players': 0,
                'total_stars': 0,
                'star_counts': {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            }
        
        prestige_stats[prestige]['total_players'] += 1
        prestige_stats[prestige]['total_stars'] += player.stars
        prestige_stats[prestige]['star_counts'][player.stars] += 1
    
    # Calculate team ratings by prestige
    for team in teams:
        prestige = team.prestige
        team_counts[prestige] = team_counts.get(prestige, 0) + 1
        
        if prestige not in team_ratings:
            team_ratings[prestige] = {'total_rating': 0, 'count': 0}
        
        team_ratings[prestige]['total_rating'] += team.rating
        team_ratings[prestige]['count'] += 1
    
    # Calculate prestige vs stars percentage table
    prestige_stars_table = []
    for prestige in sorted(prestige_stats.keys()):
        stats = prestige_stats[prestige]
        total_players = stats['total_players']
        
        if total_players > 0:
            avg_team_rating = round(team_ratings[prestige]['total_rating'] / team_ratings[prestige]['count'], 1)
            avg_stars = round(stats['total_stars'] / total_players, 2)
            
            row = {
                'prestige': prestige,
                'avg_rating': avg_team_rating,
                'avg_stars': avg_stars,
                'star_percentages': {}
            }
            
            # Calculate star distribution percentages
            for star in range(1, 6):
                percentage = round((stats['star_counts'][star] / total_players) * 100, 1)
                row['star_percentages'][star] = percentage
            
            prestige_stars_table.append(row)
    
    # Calculate total star counts across all teams
    total_star_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    star_ratings = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    
    for player in players:
        star = player.stars
        total_star_counts[star] += 1
        star_ratings[star] += player.rating
    
    # Calculate average ratings for each star level
    star_averages = {}
    for star in range(1, 6):
        if total_star_counts[star] > 0:
            star_averages[star] = round(star_ratings[star] / total_star_counts[star], 1)
        else:
            star_averages[star] = 0
    
    # Add average ratings to the total_star_counts
    total_star_counts_with_avg = {
        'counts': total_star_counts,
        'avg_ratings': star_averages
    }
    
    # Format team counts by prestige
    team_counts_formatted = []
    for prestige in sorted(team_counts.keys()):
        team_counts_formatted.append({
            'prestige': prestige,
            'team_count': team_counts[prestige]
        })
    
    return Response(
        {
            "info": InfoSerializer(info).data,
            "team": TeamsSerializer(info.team).data,
            "prestige_stars_table": prestige_stars_table,
            "total_star_counts": total_star_counts_with_avg,
            "team_counts_by_prestige": team_counts_formatted,
            "conferences": ConferenceNameSerializer(
                info.conferences.all().order_by("confName"), many=True
            ).data,
        }
    ) 