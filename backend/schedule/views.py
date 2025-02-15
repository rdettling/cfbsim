from start.models import *
from django.shortcuts import render
from django.db.models import Q, F, ExpressionWrapper, FloatField
from operator import attrgetter


def schedule(request, week_num):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    team = info.team
    conferences = info.conferences.order_by("confName")
    games = list(info.games.filter(year=info.currentYear, weekPlayed=week_num))

    if games:
        for game in games:
            if game.labelA != game.labelB and week_num < 13:
                if game.teamA.conference and game.teamB.conference:
                    game.label = f"NC ({game.teamA.conference.confName} vs {game.teamB.conference.confName})"
                elif not game.teamA.conference:
                    game.label = f"NC (Ind vs {game.teamB.conference.confName})"
                elif not game.teamB.conference:
                    game.label = f"NC ({game.teamA.conference.confName} vs Ind)"
            else:
                game.label = game.labelA

        games.sort(key=lambda game: (game.rankATOG + game.rankBTOG) / 2)
        games[0].game_of_week = True

    context = {
        "week_num": week_num,
        "games": games,
        "team": team,
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "info": info,
        "conferences": conferences,
    }

    return render(request, "week_schedule.html", context)

def playoff(request):
    user_id = request.session.session_key
    info = Info.objects.get(user_id=user_id)

    # Get the number of autobids
    autobids = info.playoff.autobids

    # Get conference champions or top teams from each conference
    conference_champions = []
    for conference in info.conferences.all():
        if conference.championship and conference.championship.winner:
            conference_champions.append(conference.championship.winner)
        else:
            conf_teams = conference.teams.annotate(
                win_percentage=ExpressionWrapper(
                    F('confWins') * 1.0 / (F('confWins') + F('confLosses')),
                    output_field=FloatField()
                )
            ).order_by('-win_percentage', '-confWins', 'ranking', '-totalWins')
            if conf_teams.exists():
                conference_champions.append(conf_teams.first())

    # Sort conference champions by ranking
    conference_champions.sort(key=attrgetter('ranking'))

    # Get the top 4 seeds (conference champions from different conferences)
    top_4_seeds = []
    seen_conferences = set()
    for team in conference_champions:
        if team.conference.confName not in seen_conferences:
            top_4_seeds.append(team)
            seen_conferences.add(team.conference.confName)
        if len(top_4_seeds) == 4:
            break

    # Get the remaining autobid teams
    remaining_autobids = conference_champions[len(top_4_seeds):autobids]

    # Get all other teams (excluding all autobid teams)
    other_teams = Teams.objects.filter(info=info).exclude(
        id__in=[team.id for team in top_4_seeds + remaining_autobids]
    ).order_by('ranking')

    # Select the remaining at-large teams
    at_large_teams = list(other_teams)[:8 - len(remaining_autobids)]

    # Get the bubble teams (5 highest ranked at-large teams that didn't make it)
    bubble_teams = list(other_teams)[len(at_large_teams):len(at_large_teams)+5]

    # Combine all teams and sort by ranking (except top 4)
    playoff_teams = top_4_seeds + sorted(remaining_autobids + at_large_teams, key=attrgetter('ranking'))

    # Assign seeds and mark autobid teams
    for i, team in enumerate(playoff_teams, 1):
        team.seed = i
        team.is_autobid = team in (top_4_seeds + remaining_autobids)

    for team in playoff_teams:
        print(team.name, team.seed, team.is_autobid)

    # Sort conference champions by ranking for display
    sorted_conference_champions = sorted(conference_champions, key=attrgetter('ranking'))

    for a in sorted_conference_champions:
        print(a.name)

    context = {
        "weeks": [i for i in range(1, info.playoff.lastWeek + 1)],
        "info": info,
        "playoff_teams": playoff_teams,
        "bubble_teams": bubble_teams,
        "conference_champions": sorted_conference_champions,  # Add this line
    }

    return render(request, "playoff.html", context)
