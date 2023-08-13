from django.shortcuts import render
from start.models import *

def rankings(request):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)
    team = info.team
    teams = Teams.objects.filter(info=info).order_by('ranking')
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    context = {
        'teams' : teams,
        'team' : team,
        'conferences' : conferences,
        'info' : info
    }

    return render(request, 'rankings.html', context)

def standings(request, conference_name):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)
    conferences = Conferences.objects.filter(info=info).order_by('confName')    
    team = info.team

    if conference_name != 'independent':
        conference = Conferences.objects.get(info=info, confName=conference_name)
        teams = conference.teams.all().order_by('-confWins', '-resume', '-totalWins')

        context = {
            'conference' : conference,
            'conferences' : conferences,
            'teams' : teams,
            'info' : info,
            'team' : team
        }

        return render(request, 'standings.html', context)
    else:
        teams = Teams.objects.filter(info=info, conference=None).order_by('-totalWins', '-resume')

        context = {
            'teams' : teams,
            'team' : team,
            'conferences' : conferences,
            'info' : info
        }
        
        return render(request, 'independents.html', context)