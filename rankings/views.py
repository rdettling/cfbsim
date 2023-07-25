from django.template import loader
from django.http import HttpResponse
from django.shortcuts import render
from start.models import *

def rankings(request):
    template = loader.get_template('rankings.html')

    teams = Teams.objects.all().order_by('ranking')
    info = Info.objects.get()
    team = info.team
    conferences = Conferences.objects.all().order_by('confName')

    context = {
        'teams' : teams,
        'team' : team,
        'conferences' : conferences,
        'info' : info
    }

    return HttpResponse(template.render(context, request))

def standings(request, conference):
    conferences = Conferences.objects.all().order_by('confName')
    info = Info.objects.get()
    team = info.team

    if conference != 'independent':
        template = loader.get_template('standings.html')

        teams = Teams.objects.filter(conference=conference).order_by('-confWins', '-resume')
        conference = Conferences.objects.get(confName=conference)

        context = {
            'conference' : conference,
            'conferences' : conferences,
            'teams' : teams,
            'info' : info,
            'team' : team
        }

        return HttpResponse(template.render(context, request))
    else:
        template = loader.get_template('independents.html')

        teams = Teams.objects.filter(conference=None).order_by('-totalWins', '-resume')

        context = {
            'teams' : teams,
            'team' : team,
            'conferences' : conferences,
            'info' : info
        }
        
        return HttpResponse(template.render(context, request))