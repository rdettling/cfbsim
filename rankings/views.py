from django.shortcuts import render
from start.models import *


def get_last_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(weekPlayed=info.currentWeek - 1)
    games_as_teamB = team.games_as_teamB.filter(weekPlayed=info.currentWeek - 1)
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        last_game = schedule[-1]
        if last_game.teamA == team:
            last_game.opponent = last_game.teamB
            last_game.result = last_game.resultA
            last_game.rank = last_game.rankBTOG
            if not last_game.overtime:
                last_game.score = f"{last_game.scoreA} - {last_game.scoreB}"
            else:
                if last_game.overtime == 1:
                    last_game.score = f"{last_game.scoreA} - {last_game.scoreB} OT"
                else:
                    last_game.score = f"{last_game.scoreA} - {last_game.scoreB} {last_game.overtime}OT"
        else:
            last_game.opponent = last_game.teamA
            last_game.result = last_game.resultB
            last_game.rank = last_game.rankATOG
            if not last_game.overtime:
                last_game.score = f"{last_game.scoreB} - {last_game.scoreA}"
            else:
                if last_game.overtime == 1:
                    last_game.score = f"{last_game.scoreB} - {last_game.scoreA} OT"
                else:
                    last_game.score = f"{last_game.scoreB} - {last_game.scoreA} {last_game.overtime}OT"
        return last_game
    else:
        return None


def get_next_game(info, team):
    games_as_teamA = team.games_as_teamA.filter(weekPlayed=info.currentWeek)
    games_as_teamB = team.games_as_teamB.filter(weekPlayed=info.currentWeek)
    schedule = list(games_as_teamA | games_as_teamB)
    if schedule:
        next_game = schedule[-1]
        if next_game.teamA == team:
            next_game.opponent = next_game.teamB
            next_game.rank = next_game.teamB.ranking
            next_game.spread = next_game.spreadA
        else:
            next_game.opponent = next_game.teamA
            next_game.rank = next_game.teamA.ranking
            next_game.spread = next_game.spreadB

        return next_game
    else:
        return None


def rankings(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)
    team = info.team
    teams = Teams.objects.filter(info=info).order_by("ranking")
    conferences = Conferences.objects.filter(info=info).order_by("confName")

    for team in teams:
        team.last_game = get_last_game(info, team)
        team.next_game = get_next_game(info, team)

        if team.last_rank:
            team.diff = team.last_rank - team.ranking
        else:
            team.diff = 0

    context = {
        "teams": teams,
        "team": team,
        "conferences": conferences,
        "info": info,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
    }

    return render(request, "rankings.html", context)


def standings(request, conference_name):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    if conference_name != "independent":
        conference = info.conferences.get(confName=conference_name)
        teams = list(conference.teams.all())

        for team in teams:
            if team.confWins + team.confLosses > 0:
                team.pct = team.confWins / (team.confWins + team.confLosses)
            else:
                team.pct = 0

        teams.sort(key=lambda o: (-o.pct, -o.confWins, o.confLosses, o.ranking))

        context = {
            "conference": conference,
            "conferences": info.conferences.order_by("confName"),
            "teams": teams,
            "info": info,
            "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        }

        return render(request, "standings.html", context)
    else:
        teams = info.teams.filter(conference=None).order_by("-totalWins", "-resume")

        context = {
            "teams": teams,
            "conferences": info.conferences.order_by("confName"),
            "info": info,
            "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        }

        return render(request, "independents.html", context)
