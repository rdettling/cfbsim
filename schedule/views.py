from start.models import *
from django.shortcuts import render

def schedule(request, week_num):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    team = info.team
    conferences = Conferences.objects.filter(info=info).order_by('confName')
    games = Games.objects.filter(info=info, weekPlayed=week_num)

    context = {
        'week_num' : week_num,
        'games' : games,
        'team' : team,
        'info' : info,
        'conferences' : conferences
    }

    return render(request, 'week_schedule.html', context)