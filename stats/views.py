from django.shortcuts import render
from start.models import *
from django.db.models import Sum
from django.db.models.functions import Coalesce

def teamstats(request):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)
    team = info.team
    teams = Teams.objects.filter(info=info)

    offense = {}
    defense = {}

    for team in teams:
        offense[team.name] = stats(team, 'offense')
        defense[team.name] = stats(team, 'defense')

    context = {
        'team': team,
        'info': info,
        'offense': offense,
        'defense' : defense
    }

    return render(request, 'team.html', context)


def individualstats(request, category):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)
    team = info.team

    if category == 'passing':
        stats = passing(info)



    context = {
        'team' : team,
        'info' : info,
        'stats' : stats
    }


    return render(request, 'individual.html', context)


def passing(info):
    stats = {}


    return stats


def stats(team, side):
    stats = {}
    pass_yards, rush_yards = 0, 0
    comp, att, rush_att = 0, 0, 0
    pass_td, rush_td = 0, 0
    int, fumble = 0, 0
    play_count = 0
    games = team.totalWins + team.totalLosses
    stats['games'] = games

    if side == 'offense':
        points = Games.objects.filter(teamA=team).aggregate(total_score_as_teamA=Coalesce(Sum('scoreA'), 0))['total_score_as_teamA'] + Games.objects.filter(teamB=team).aggregate(total_score_as_teamB=Coalesce(Sum('scoreB'), 0))['total_score_as_teamB'] 
        plays = Plays.objects.filter(offense=team)
    elif side == 'defense':
        points = Games.objects.filter(teamA=team).aggregate(total_score_as_teamA=Coalesce(Sum('scoreB'), 0))['total_score_as_teamA'] + Games.objects.filter(teamB=team).aggregate(total_score_as_teamB=Coalesce(Sum('scoreA'), 0))['total_score_as_teamB'] 
        plays = Plays.objects.filter(defense=team)

    for play in plays:
        if play.playType == 'pass':
            play_count += 1
            pass_yards += play.yardsGained
            if play.result == 'pass':
                comp += 1
                att += 1
            elif play.result == 'touchdown':
                comp += 1
                att += 1
                pass_td += 1
            elif play.result == 'incomplete pass':
                att += 1
            elif play.result == 'interception':
                att += 1
                int += 1

        elif play.playType == 'run':
            play_count += 1
            rush_yards += play.yardsGained
            if play.result == 'run':
                rush_att += 1
            elif play.result == 'touchdown':
                rush_att += 1
                rush_td += 1
            elif play.result == 'fumble':
                fumble += 1
            
    if games != 0:
        stats['ppg'] = round(points / games, 1)
        stats['pass_cpg'] = round(comp / games, 1)
        stats['pass_apg'] = round(att / games, 1)
        stats['pass_ypg'] = round(pass_yards / games, 1)
        stats['pass_tdpg'] = round(pass_td / games, 1)
        stats['rush_apg'] = round(rush_att / games, 1)
        stats['rush_ypg'] = round(rush_yards / games, 1)
        stats['rush_ypc'] = round(rush_yards / rush_att, 1)
        stats['rush_tdpg'] = round(rush_td / games, 1)
        stats['playspg'] = round(play_count / games, 1)
        stats['yardspg'] = round(stats['pass_ypg'] + stats['rush_ypg'], 1)
        stats['ypp'] = round(stats['yardspg'] / stats['playspg'], 1)
    else:
        stats['ppg'] = 0
        stats['pass_cpg'] = 0
        stats['pass_apg'] = 0
        stats['pass_ypg'] = 0
        stats['pass_tdpg'] = 0
        stats['rush_apg'] = 0
        stats['rush_ypg'] = 0
        stats['rush_ypc'] = 0
        stats['rush_tdpg'] = 0
        stats['playspg'] = 0
        stats['yardspg'] = 0
        stats['ypp'] = 0
    
    if att != 0:
        stats['comp_percent'] = round(comp / att * 100, 1)
    else:
        stats['comp_percent'] = 0

    return stats