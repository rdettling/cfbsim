from start.models import *
from django.shortcuts import render


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
