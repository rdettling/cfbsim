from start.models import *
import static.sim as sim
from django.shortcuts import render
from django.db.models import Q

def schedule(request, team_name):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)

    games_as_teamA = team.games_as_teamA.all()
    games_as_teamB = team.games_as_teamB.all()
    schedule = list(games_as_teamA | games_as_teamB)
    schedule = sorted(schedule, key=lambda game: game.weekPlayed)

    teams = Teams.objects.filter(info=info).order_by('name')
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    for week in schedule:
        if week.teamA == team:
            opponent = week.teamB
            week.label = week.labelA
            week.moneyline = week.moneylineA
            week.spread = week.spreadA
            week.gameNum = week.gameNumA
            week.result = week.resultA
            if not week.overtime:
                week.score = f'{week.scoreA} - {week.scoreB}'
            else:
                if week.overtime == 1:
                    week.score = f'{week.scoreA} - {week.scoreB} OT'
                else:
                    week.score = f'{week.scoreA} - {week.scoreB} {week.overtime}OT'
        else:
            opponent = week.teamA
            week.label = week.labelB
            week.moneyline = week.moneylineB
            week.spread = week.spreadB
            week.gameNum = week.gameNumB
            week.result = week.resultB
            if not week.overtime:
                week.score = f'{week.scoreB} - {week.scoreA}'
            else:
                if week.overtime == 1:
                    week.score = f'{week.scoreB} - {week.scoreA} OT'
                else:
                    week.score = f'{week.scoreB} - {week.scoreA} {week.overtime}OT'
        week.opponent = opponent.name
        week.rating = opponent.rating
        week.ranking = opponent.ranking
        week.opponentRecord = f'{opponent.totalWins} - {opponent.totalLosses} ({opponent.confWins} - {opponent.confLosses})'

    context = {
        'team' : team,
        'teams' : teams,
        'schedule' : schedule,
        'info' : info,
        'conferences' : conferences
    }
    
    return render(request, 'schedule.html', context)


def roster(request, team_name):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    teams = Teams.objects.filter(info=info).order_by('name')
    roster = Players.objects.filter(info=info, team=team)
    positions = roster.values_list('pos', flat=True).distinct()
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    context = {
        'team': team,
        'teams': teams,
        'roster': roster,
        'info': info,
        'conferences': conferences,
        'positions': positions
    }
    
    return render(request, 'roster.html', context)

def player(request, team_name, id):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    player = Players.objects.get(info=info, id=id)
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    context = {
         'team' : team,
         'player' : player,
         'info' : info,
         'conferences' : conferences
    }
    
    return render(request, 'player.html', context)

def stats(request, team_name):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    team = Teams.objects.get(info=info, name=team_name)
    teams = Teams.objects.filter(info=info).order_by('name')
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    context = {
         'team' : team,
         'teams' : teams,
         'info' : info,
         'conferences' : conferences
    }

    print(context)
    
    return render(request, 'stats.html', context)

def simWeek(request, team_name, desired_week):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    resumeFactor = 1.5
    
    Team = Teams.objects.get(info=info, name=team_name)   
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    drives_to_create = []
    plays_to_create = []
    teamGames = []

    if desired_week == 1 and info.currentWeek > 1:
        desired_week = info.currentWeek

    while info.currentWeek <= desired_week: 
        toBeSimmed = list(Games.objects.filter(info=info, weekPlayed=info.currentWeek))

        for game in toBeSimmed:
            if game.teamA == Team:
                game.num = game.gameNumA
                game.label = game.labelA
                teamGames.append(game)
            elif game.teamB == Team:
                game.num = game.gameNumB
                game.label = game.labelB
                teamGames.append(game)

            print(f'Week: {game.weekPlayed} -> simming {game.teamA.name} vs {game.teamB.name}')
            sim.simGame(info, game, drives_to_create, plays_to_create, resumeFactor)

        teams = Teams.objects.filter(info=info).order_by('-resume') 
        for i, team in enumerate(teams, start=1):
            team.ranking = i
            team.save()

        if info.currentWeek == 12:
            setConferenceChampionships(info)
        elif info.currentWeek == 13:
            setPlayoff(info)
        elif info.currentWeek == 14:
            setNatty(info)
        info.currentWeek += 1

    Teams.objects.bulk_update(teams, ['ranking'])
    Drives.objects.bulk_create(drives_to_create)
    Plays.objects.bulk_create(plays_to_create)

    info.save()

    context = {
        'team' : Team,
        'conferences' : conferences,
        'teamGames' : teamGames,
        'info' : info
    }
    
    return render(request, 'sim.html', context)

def details(request, team_name, game_num):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    conferences = Conferences.objects.filter(info=info).order_by('confName')
    team = Teams.objects.get(info=info, name=team_name)
    game = get_game_by_team_and_gamenum(info, team, game_num)
    drives = game.drives.all()

    game.team = team
    if game.teamA == team:
        game.opponent = game.teamB
        game.team.score = game.scoreA
        game.opponent.score = game.scoreB
    else:
        game.opponent = game.teamA
        game.team.score = game.scoreB
        game.opponent.score = game.scoreA

    scoreA = scoreB = 0
    for drive in drives:
        if drive.offense == team:
            if drive.points:
                scoreA += drive.points
            elif drive.result == 'safety':
                scoreB += 2
        elif drive.offense == game.opponent:
            if drive.points:
                scoreB += drive.points
            elif drive.result == 'safety':
                scoreA += 2
        drive.teamAfter = scoreA
        drive.oppAfter = scoreB

    team_yards = opp_yards = 0
    team_passing_yards = team_rushing_yards = opp_passing_yards = opp_rushing_yards = 0
    team_first_downs = opp_first_downs = 0
    team_third_down_a = team_third_down_c = opp_third_down_a = opp_third_down_c = 0
    team_fourth_down_a = team_fourth_down_c = opp_fourth_down_a = opp_fourth_down_c = 0
    team_turnovers = opp_turnovers = 0
    for play in Plays.objects.filter(game=game):
        if play.startingFP < 50:
            location = f'own {play.startingFP}'
        elif play.startingFP > 50:
            location = f'opp {100 - play.startingFP}'
        else:
            location = f'{play.startingFP}'

        if play.startingFP + play.yardsLeft >= 100:
            if play.down == 1:
                play.header = f'{play.down}st and goal at {location}'
            elif play.down == 2:
                play.header = f'{play.down}nd and goal at {location}'
            elif play.down == 3:
                play.header = f'{play.down}rd and goal at {location}'
            elif play.down == 4:
                play.header = f'{play.down}th and goal at {location}'
        else:
            if play.down == 1:
                play.header = f'{play.down}st and {play.yardsLeft} at {location}'
            elif play.down == 2:
                play.header = f'{play.down}nd and {play.yardsLeft} at {location}'
            elif play.down == 3:
                play.header = f'{play.down}rd and {play.yardsLeft} at {location}'
            elif play.down == 4:
                play.header = f'{play.down}th and {play.yardsLeft} at {location}'

        play.save()

        if play.offense == team:
            if play.playType == 'pass':
                team_passing_yards += play.yardsGained
            elif play.playType == 'run':
                team_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                team_first_downs += 1
            if play.result == 'interception' or play.result == 'fumble':
                team_turnovers += 1
            elif play.down == 3:
                team_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    team_third_down_c += 1
            elif play.down == 4:
                if play.playType != 'punt' and play.playType != 'field goal attempt':
                    team_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        team_fourth_down_c += 1
        elif play.offense == game.opponent:
            if play.playType == 'pass':
                opp_passing_yards += play.yardsGained
            elif play.playType == 'run':
                opp_rushing_yards += play.yardsGained
            if play.yardsGained >= play.yardsLeft:
                opp_first_downs += 1
            if play.result == 'interception' or play.result == 'fumble':
                opp_turnovers += 1
            elif play.down == 3:
                opp_third_down_a += 1
                if play.yardsGained >= play.yardsLeft:
                    opp_third_down_c += 1
            elif play.down == 4:
                if play.playType != 'punt' and play.playType != 'field goal attempt':
                    opp_fourth_down_a += 1
                    if play.yardsGained >= play.yardsLeft:
                        opp_fourth_down_c += 1

    team_yards = team_passing_yards + team_rushing_yards
    opp_yards = opp_passing_yards + opp_rushing_yards

    stats = {
        'total yards' : {
            'team' : team_yards,
            'opponent' : opp_yards
        },
        'passing yards' : {
            'team' : team_passing_yards,
            'opponent' : opp_passing_yards
        },
        'rushing yards' : {
            'team' : team_rushing_yards,
            'opponent' : opp_rushing_yards
        },
        '1st downs' : {
            'team' : team_first_downs,
            'opponent' : opp_first_downs
        },
        '3rd down conversions' : {
            'team' : team_third_down_c,
            'opponent' : opp_third_down_c
        },
        '3rd down attempts' : {
            'team' : team_third_down_a,
            'opponent' : opp_third_down_a
        },
        '4th down conversions' : {
            'team' : team_fourth_down_c,
            'opponent' : opp_fourth_down_c
        },
        '4th down attempts' : {
            'team' : team_fourth_down_a,
            'opponent' : opp_fourth_down_a
        },
        'turnovers' : {
            'team' : team_turnovers,
            'opponent' : opp_turnovers
        }
    }
        
    context = {
        'team' : team,
        'game' : game,
        'info' : info,
        'conferences' : conferences,
        'drives' : drives,
        'stats' : stats
    }
    
    return render(request, 'game.html', context)

def setConferenceChampionships(info):
    conferences = Conferences.objects.filter(info=info)

    for conference in conferences:
        teams = conference.teams.order_by('-confWins', '-resume')

        teamA = teams[0]
        teamB = teams[1]

        odds = sim.getSpread(teamA.rating, teamB.rating)

        Games.objects.create(
            info=info,
            teamA=teamA, 
            teamB=teamB,    
            labelA=f'{conference.confName} championship',  
            labelB=f'{conference.confName} championship',  
            spreadA=odds['spreadA'],  
            spreadB=odds['spreadB'],
            moneylineA=odds['moneylineA'],  
            moneylineB=odds['moneylineB'],
            winProbA=odds['winProbA'],  
            winProbB=odds['winProbB'],
            weekPlayed=13,
            gameNumA=13,
            gameNumB=13,
            overtime=0,
        )

def setPlayoff(info):
    teams = Teams.objects.filter(info=info).order_by('-resume')

    team1 = teams[0]
    team2 = teams[1]
    team3 = teams[2]
    team4 = teams[3]

    odds = sim.getSpread(team1.rating, team4.rating)
    Games.objects.create(
        info=info,
        teamA=team1, 
        teamB=team4,    
        labelA='Playoff semifinal 1v4',  
        labelB='Playoff semifinal 4v1',  
        spreadA=odds['spreadA'],  
        spreadB=odds['spreadB'],
        moneylineA=odds['moneylineA'],  
        moneylineB=odds['moneylineB'],
        winProbA=odds['winProbA'],  
        winProbB=odds['winProbB'],
        weekPlayed=14,
        gameNumA=14,
        gameNumB=14,
        overtime=0,
    )

    odds = sim.getSpread(team2.rating, team3.rating)
    Games.objects.create(
        info=info,
        teamA=team2, 
        teamB=team3,    
        labelA='Playoff semifinal 2v3',  
        labelB='Playoff semifinal 3v2',  
        spreadA=odds['spreadA'],  
        spreadB=odds['spreadB'],
        moneylineA=odds['moneylineA'],  
        moneylineB=odds['moneylineB'],
        winProbA=odds['winProbA'],  
        winProbB=odds['winProbB'],
        weekPlayed=14,
        gameNumA=14,
        gameNumB=14,
        overtime=0,
    )
    

def setNatty(info):
    games_week_14 = Games.objects.filter(info=info, weekPlayed=14)
    week_14_winners = []
    for game in games_week_14:
        week_14_winners.append(game.winner)

    teamA = week_14_winners[0]
    teamB = week_14_winners[1]

    odds = sim.getSpread(teamA.rating, teamB.rating)
    Games.objects.create(
        info=info,
        teamA=teamA, 
        teamB=teamB,    
        labelA='Natty',  
        labelB='Natty',  
        spreadA=odds['spreadA'],  
        spreadB=odds['spreadB'],
        moneylineA=odds['moneylineA'],  
        moneylineB=odds['moneylineB'],
        winProbA=odds['winProbA'],  
        winProbB=odds['winProbB'],
        weekPlayed=15,
        gameNumA=15,
        gameNumB=15,
        overtime=0,
    )


def get_game_by_team_and_gamenum(info, team, game_num):
    game = Games.objects.filter(
        Q(info=info),
        Q(teamA=team, gameNumA=game_num) | Q(teamB=team, gameNumB=game_num)
    ).first()
    return game