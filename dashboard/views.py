from start.models import *
from django.shortcuts import render

def dashboard(request):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    team_name = request.GET.get('team_name')
    
    if team_name:
        team = Teams.objects.get(info=info, name=team_name)
        info.team = team
        info.save()
    else:
        team = info.team

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    for week in schedule:
        week.team = team
        if week.teamA == team:
            week.opponent =  week.teamB
            week.result = week.resultA
            week.gameNum = week.gameNumA
            week.score = f'{week.scoreA} - {week.scoreB}'
        else:
            week.opponent =  week.teamA
            week.result = week.resultB
            week.gameNum = week.gameNumB
            week.score = f'{week.scoreB} - {week.scoreA}'

    teams = Teams.objects.filter(info=info).order_by('ranking')
    conferences = Conferences.objects.filter(info=info).order_by('confName')
    confTeams = Teams.objects.filter(info=info, conference=team.conference).order_by('-confWins', '-resume')

    for week in schedule:
        try:
            opponent = Teams.objects.get(user=info, name=week.opponent)
            week.ranking = opponent.ranking
        except:
            week.ranking = None

    context = {
         'team' : team, 
         'teams' : teams,
         'confTeams' : confTeams,
         'conferences' : conferences,
         'info' : info,
         'schedule' : schedule
    }
    
    return render(request, 'dashboard.html', context)