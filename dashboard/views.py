from start.models import *
from django.shortcuts import render
from start.views import fillSchedules


def dashboard(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.team

    if info.currentWeek == 1:
        fillSchedules(info)

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    for week in schedule:
        week.team = team
        if week.teamA == team:
            week.opponent = week.teamB
            week.result = week.resultA
            week.score = f"{week.scoreA} - {week.scoreB}"
            week.spread = week.spreadA
            week.moneyline = week.moneylineA
        else:
            week.opponent = week.teamA
            week.result = week.resultB
            week.score = f"{week.scoreB} - {week.scoreA}"
            week.spread = week.spreadB
            week.moneyline = week.moneylineB

    teams = Teams.objects.filter(info=info).order_by("ranking")
    conferences = Conferences.objects.filter(info=info).order_by("confName")
    confTeams = Teams.objects.filter(info=info, conference=team.conference).order_by(
        "-confWins", "-resume"
    )

    context = {
        "team": team,
        "teams": teams,
        "confTeams": confTeams,
        "conferences": conferences,
        "info": info,
        "schedule": schedule,
    }

    return render(request, "dashboard.html", context)
