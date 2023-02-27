from django.template import loader
from django.http import HttpResponse
from django.shortcuts import render
from start.models import *

def rankings(request):
    template = loader.get_template('rankings.html')

    teams = Teams.objects.all().order_by('ranking')
    weeks = Weeks.objects.get()
    conferences = Conferences.objects.all().order_by('confName')

    context = {
        'teams' : teams,
        'conferences' : conferences,
        'weeks' : weeks
    }

    return HttpResponse(template.render(context, request))

def standings(request, conference):
    conferences = Conferences.objects.all().order_by('confName')
    weeks = Weeks.objects.get()

    if conference != 'independent':
        template = loader.get_template('standings.html')

        teams = Teams.objects.filter(conference=conference).order_by('-confWins', '-resume')
        conference = Conferences.objects.get(confName=conference)

        context = {
            'conference' : conference,
            'conferences' : conferences,
            'teams' : teams,
            'weeks' : weeks
        }

        return HttpResponse(template.render(context, request))
    else:
        template = loader.get_template('independents.html')

        teams = Teams.objects.filter(conference=None).order_by('-totalWins', '-resume')

        context = {
            'teams' : teams,
            'conferences' : conferences,
            'weeks' : weeks
        }
        
        return HttpResponse(template.render(context, request))