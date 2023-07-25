from start.models import *
from django.template import loader
from django.http import HttpResponse

def dashboard(request):
    team_name = request.GET.get('team_name')
    info = Info.objects.get()

    if team_name:
        team = Teams.objects.get(name=team_name)
        info.team = team
        info.save()
    else:
        team = Teams.objects.get(name=info.team.name)

    schedule = Games.objects.filter(team=team.name)
    teams = Teams.objects.all().order_by('ranking')
    conferences = Conferences.objects.all().order_by('confName')
    
    confTeams = Teams.objects.filter(conference=team.conference).order_by('-confWins', '-resume')

    for week in schedule:
        try:
            opponent = Teams.objects.get(name=week.opponent)
            week.ranking = opponent.ranking
        except:
            week.ranking = None

    template = loader.get_template('dashboard.html')

    context = {
         'team' : team, 
         'teams' : teams,
         'confTeams' : confTeams,
         'conferences' : conferences,
         'info' : info,
         'schedule' : schedule
    }
    
    return HttpResponse(template.render(context, request))