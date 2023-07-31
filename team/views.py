from django.template import loader
from django.http import HttpResponse
from django.forms.models import model_to_dict
from django.db.models import Max
from start.models import *
import static.sim as sim

def schedule(request, team):
    schedule = Games.objects.filter(team=team)
    team = Teams.objects.get(name=team)
    teams = Teams.objects.all().order_by('name')
    info = Info.objects.get()
    conferences = Conferences.objects.all().order_by('confName')

    for week in schedule:
        try:
            opponent = Teams.objects.get(name=week.opponent)
            week.rating = opponent.rating
            week.ranking = opponent.ranking
            week.opponentRecord = f'{opponent.totalWins} - {opponent.totalLosses} ({opponent.confWins} - {opponent.confLosses})'
        except:
            week.rating = 50
            week.ranking = None
            week.opponentRecord = None

    template = loader.get_template('schedule.html')
   
    context = {
        'team' : team,
        'teams' : teams,
        'schedule' : schedule,
        'info' : info,
        'conferences' : conferences
    }
    
    return HttpResponse(template.render(context, request))

def roster(request, team):
    team = Teams.objects.get(name=team)
    teams = Teams.objects.all().order_by('name')
    roster = Players.objects.filter(team=team)
    conferences = Conferences.objects.all().order_by('confName')
    info = Info.objects.get()

    template = loader.get_template('roster.html')

    context = {
         'team' : team,
         'teams' : teams,
         'roster' : roster,
         'info' : info,
         'conferences' : conferences
    }
    
    return HttpResponse(template.render(context, request))

def player(request, team, number):
    team = Teams.objects.get(name=team)
    player = Players.objects.get(id=number)
    info = Info.objects.get()
    conferences = Conferences.objects.all().order_by('confName')

    template = loader.get_template('player.html')

    context = {
         'team' : team,
         'player' : player,
         'info' : info,
         'conferences' : conferences
    }
    
    return HttpResponse(template.render(context, request))

def stats(request, team):
    team = Teams.objects.get(name=team)
    teams = Teams.objects.all().order_by('name')
    conferences = Conferences.objects.all().order_by('confName')
    info = Info.objects.get()

    template = loader.get_template('stats.html')

    context = {
         'team' : team,
         'teams' : teams,
         'info' : info,
         'conferences' : conferences
    }
    
    return HttpResponse(template.render(context, request))

def simWeek(request, team):
    teamName = team
    resumeFactor = 1.5

    template = loader.get_template('sim.html')
    
    info = Info.objects.get()
    currentWeek = info.currentWeek
    team = Teams.objects.get(name=team)    
    conferences = Conferences.objects.all().order_by('confName')
    toBeSimmed = list(Games.objects.filter(weekPlayed=currentWeek))

    for game in toBeSimmed:
        Team = Teams.objects.get(name=game.team)
        
        if game.opponent != 'FCS':
            otherGame = Games.objects.get(gameID=game.gameID, team=game.opponent)

            if otherGame.result == 'tbd':
                opponent = Teams.objects.get(name=game.opponent)

                simmedGame = sim.simGame(Team.name, Team.rating, opponent.name, opponent.rating, game.gameID)

                if simmedGame['overtime']:
                    game.score = f"{simmedGame['scoreA']} - {simmedGame['scoreB']} ({simmedGame['overtime']}OT)"
                    game.overtime = simmedGame['overtime']
                else:
                    game.score = f"{simmedGame['scoreA']} - {simmedGame['scoreB']}"
                
                if simmedGame['winner'] == Team.name:
                    if Team.conference == opponent.conference:
                        Team.confWins += 1
                        opponent.confLosses += 1
                    else:
                        Team.nonConfWins += 1
                        opponent.nonConfLosses += 1

                    Team.resume += opponent.rating ** resumeFactor
                    Team.totalWins += 1
                    opponent.totalLosses += 1
                    game.result = 'W'
                else:
                    if Team.conference == opponent.conference:
                        Team.confLosses += 1
                        opponent.confWins += 1
                    else:
                        Team.nonConfLosses += 1
                        opponent.nonConfWins += 1
                   
                    opponent.resume += Team.rating ** resumeFactor
                    Team.totalLosses += 1
                    opponent.totalWins += 1
                    game.result = 'L'

                opponent.save()
                
            else:
                if otherGame.result == 'W':
                    game.result = 'L'
                else:
                    game.result = 'W'
                game.overtime = otherGame.overtime
                a = otherGame.score.split(' ')

                if game.overtime:
                    game.score = f"{a[2]} - {a[0]} {a[3]}"
                else:
                    game.score = f"{a[2]} - {a[0]}"

        else:
            simmedGame = sim.simGame(Team.name, Team.rating, 'FCS', 50, game.gameID)

            if simmedGame['overtime']:
                game.score = f"{simmedGame['scoreA']} - {simmedGame['scoreB']} ({simmedGame['overtime']}OT)"
                game.overtime = simmedGame['overtime']
            else:
                game.score = f"{simmedGame['scoreA']} - {simmedGame['scoreB']}"

            if simmedGame['winner'] == Team.name:
                Team.nonConfWins += 1
                Team.totalWins += 1
                game.result = 'W'
                Team.resume += 50 ** resumeFactor
            else:
                Team.nonConfLosses += 1
                Team.totalLosses += 1
                game.result = 'L'

        Team.save()
        try:
            game.save()
        except:
            print(game.spread, game.moneyline, game.spread, game.score)
    
    if currentWeek == 12:
        setConferenceChampionships()
    elif currentWeek == 13:
        setPlayoff()
    elif currentWeek == 14:
        setNatty()

    teams = Teams.objects.order_by('-resume', '-totalWins')

    for i, Team in enumerate(teams, start=1):
        Team.ranking = i
        Team.save()

    playedThisWeek = list(Games.objects.filter(team=teamName, weekPlayed=currentWeek))

    context = {
        'team' : team,
        'conferences' : conferences,
        'playedThisWeek' : playedThisWeek,
        'info' : info
    }

    info.currentWeek += 1
    info.save()
    
    return HttpResponse(template.render(context, request))

def details(request, team, number):
    template = loader.get_template(f'game.html')

    conferences = Conferences.objects.all().order_by('confName')
    info = Info.objects.get()
    Team = Teams.objects.get(name=team)
    game = Games.objects.get(team=team, gameNum=number)
    opponentGame = Games.objects.get(team=game.opponent, opponent=team, weekPlayed=game.weekPlayed)

    if game.result != 'tbd':
        if not game.overtime:
            scores = {
                'team' : game.score.split('-')[0].strip(),
                'opponent' : game.score.split('-')[1].strip()
            }
        else:
            scores = {
                'team' : game.score.split('-')[0].strip(),
                'opponent' : game.score.split('-')[1].strip().split(' ')[0]
            }

        teamyards = 0
        teamTO = 0
        team3Att = 0
        team3Con = 0
        team4Att = 0
        team4Con = 0
        oppyards = 0
        oppTO = 0
        opp3Att = 0
        opp3Con = 0
        opp4Att = 0
        opp4Con = 0

        plays = list(Plays.objects.filter(gameID=game.gameID, down=3))
        for play in plays:
            if play.offense == game.team:
                if play.yardsGained >= play.yardsLeft:
                    team3Con += 1
                team3Att += 1
            else:
                if play.yardsGained >= play.yardsLeft:
                    opp3Con += 1
                opp3Att += 1

        plays = list(Plays.objects.filter(gameID=game.gameID, down=4))
        for play in plays:
            if not (play.playType == 'punt' or play.playType == 'field goal'):
                if play.offense == game.team:
                    if play.yardsGained >= play.yardsLeft:
                        team4Con += 1
                    team4Att += 1
                else:
                    if play.yardsGained >= play.yardsLeft:
                        opp4Con += 1
                    opp4Att += 1

       
        
        drives = list(Drives.objects.filter(gameID=game.gameID))
        drive_dicts = []
        
        for drive in drives:
            drive_dict = model_to_dict(drive)
            drive_dict['teamScoreAfter'] = 0
            drive_dict['opponentScoreAfter'] = 0
            drive_dicts.append(drive_dict)
    
        
        for i in range (len(drive_dicts)):
            if drive_dicts[i]['offense'] == game.team:
                teamyards += drive_dicts[i]['yards']
                if drive_dicts[i]['result'] == 'fumble' or drive_dicts[i]['result'] == 'interception':
                    teamTO += 1

                if drive_dicts[i]['points']:
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['teamScoreAfter'] += drive_dicts[i]['points']
                elif drive_dicts[i]['result'] == 'safety':
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['opponentScoreAfter'] += 2
            elif drive_dicts[i]['offense'] == game.opponent:
                oppyards += drive_dicts[i]['yards']
                if drive_dicts[i]['result'] == 'fumble' or drive_dicts[i]['result'] == 'interception':
                    oppTO += 1

                if drive_dicts[i]['points']:
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['opponentScoreAfter'] += drive_dicts[i]['points']
                elif drive_dicts[i]['result'] == 'safety':
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['teamScoreAfter'] += 2

        stats = {
            'teamyards' : teamyards,
            'teamTO' : teamTO,
            'team3Att' : team3Att,
            'team3Con' : team3Con,
            'team4Att' : team4Att,
            'team4Con' : team4Con,

            'oppyards' : oppyards,
            'oppTO' : oppTO,
            'opp3Att' : opp3Att,
            'opp3Con' : opp3Con,
            'opp4Att' : opp4Att,
            'opp4Con' : opp4Con
        }
                
        context = {
            'team' : Team,
            'opponent' : Teams.objects.get(name=game.opponent),
            'plays' : Plays.objects.filter(gameID=game.gameID),
            'game' : game,
            'drives' : drive_dicts,
            'scores' : scores,
            'opponentGame' : opponentGame,
            'conferences' : conferences,
            'info' : info,
            'stats' : stats
        }
    else:
        context = {
            'team' : Team,
            'opponent' : Teams.objects.get(name=game.opponent),
            'game' : game,
            'info' : info,
            'opponentGame' : opponentGame,
            'conferences' : conferences
        }
    
    return HttpResponse(template.render(context, request))

def setConferenceChampionships():
    conferences = Conferences.objects.all()
    max_game_id = Games.objects.all().aggregate(Max('gameID'))['gameID__max']

    for conference in conferences:
        teams = list(Teams.objects.filter(conference=conference.confName).order_by('-confWins', '-resume'))
        teamA = teams[0]
        teamB = teams[1]

        odds = sim.getSpread(teamA.rating, teamB.rating)

        Games.objects.create(
            gameID = max_game_id + 1,
            team = teamA.name,
            opponent = teamB.name,
            label = f"{conference.confName} championship",
            spread = odds['spreadA'],
            moneyline = odds['moneylineA'],
            winProb = odds['winProbA'],
            weekPlayed = 13,
            gameNum = 13,
            result = 'tbd',
            overtime = 0
        )
        Games.objects.create(
            gameID = max_game_id + 1,
            team = teamB.name,
            opponent = teamA.name,
            label = f"{conference.confName} championship",
            spread = odds['spreadB'],
            moneyline = odds['moneylineB'],
            winProb = odds['winProbB'],
            weekPlayed = 13,
            gameNum = 13,
            result = 'tbd',
            overtime = 0
        )
        max_game_id += 1

def setPlayoff():
    teams = list(Teams.objects.order_by('-resume'))
    max_game_id = Games.objects.all().aggregate(Max('gameID'))['gameID__max']

    team1 = teams[0]
    team2 = teams[1]
    team3 = teams[2]
    team4 = teams[3]

    odds = sim.getSpread(team1.rating, team4.rating)

    Games.objects.create(
        gameID = max_game_id + 1,
        team = team1.name,
        opponent = team4.name,
        label = 'Playoff Semifinal 1v4',
        spread = odds['spreadA'],
        moneyline = odds['moneylineA'],
        winProb = odds['winProbA'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd',
        overtime = 0
    )
    Games.objects.create(
        gameID = max_game_id + 1,
        team = team4.name,
        opponent = team1.name,
        label = 'Playoff Semifinal 4v1',
        spread = odds['spreadB'],
        moneyline = odds['moneylineB'],
        winProb = odds['winProbB'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd',
        overtime = 0
    )

    odds = sim.getSpread(team2.rating, team3.rating)

    Games.objects.create(
        gameID = max_game_id + 2,
        team = team2.name,
        opponent = team3.name,
        label = 'Playoff Semifinal 2v3',
        spread = odds['spreadA'],
        moneyline = odds['moneylineA'],
        winProb = odds['winProbA'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd',
        overtime = 0
    )
    Games.objects.create(
        gameID = max_game_id + 2,
        team = team3.name,
        opponent = team2.name,
        label = 'Playoff Semifinal 3v2',
        spread = odds['spreadB'],
        moneyline = odds['moneylineB'],
        winProb = odds['winProbB'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd',
        overtime = 0
    )

def setNatty():
    teams = Games.objects.filter(result='W', label__startswith='Playoff Semifinal').values_list('team', flat=True)
    max_game_id = Games.objects.all().aggregate(Max('gameID'))['gameID__max']

    teamA = Teams.objects.get(name=teams[0])
    teamB = Teams.objects.get(name=teams[1])

    odds = sim.getSpread(teamA.rating, teamB.rating)

    Games.objects.create(
        gameID = max_game_id + 1,
        team = teamA.name,
        opponent = teamB.name,
        label = 'Natty',
        spread = odds['spreadA'],
        moneyline = odds['moneylineA'],
        winProb = odds['winProbA'],
        weekPlayed = 15,
        gameNum = 15,
        result = 'tbd',
        overtime = 0
    )
    Games.objects.create(
        gameID = max_game_id + 1,
        team = teamB.name,
        opponent = teamA.name,
        label = 'Natty',
        spread = odds['spreadB'],
        moneyline = odds['moneylineB'],
        winProb = odds['winProbB'],
        weekPlayed = 15,
        gameNum = 15,
        result = 'tbd',
        overtime = 0
    )
