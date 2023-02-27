from django.template import loader
from django.http import HttpResponse
from django.forms.models import model_to_dict
import random
from start.models import *

def teampage(request, team):
    teamName = team[:-5]

    team = Teams.objects.get(name=teamName)
    schedule = Games.objects.filter(team=teamName)
    weeks = Weeks.objects.get()
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

    template = loader.get_template('team.html')
   
    context = {
        'team' : team,
        'schedule' : schedule,
        'weeks' : weeks,
        'conferences' : conferences
    }
    
    return HttpResponse(template.render(context, request))

def sim(request, team):
    resumeFactor = 1.5

    template = loader.get_template('sim.html')

    team = Teams.objects.get(name=team)
    weeks = Weeks.objects.get()
    currentWeek = weeks.currentWeek
    conferences = Conferences.objects.all().order_by('confName')

    toBeSimmed = list(Games.objects.filter(weekPlayed=currentWeek))

    for game in toBeSimmed:
        Team = Teams.objects.get(name=game.team)
        
        if game.opponent != 'FCS':
            otherGame = Games.objects.get(weekPlayed=currentWeek, team=game.opponent, opponent=game.team)

            if otherGame.result == 'tbd':
                opponent = Teams.objects.get(name=game.opponent)

                simmedGame = simGame(game.gameID, Team.name, Team.rating, opponent.name, opponent.rating)

                game.score = f"{simmedGame['scoreA']} - {simmedGame['scoreB']}"
                otherGame.score = f"{simmedGame['scoreB']} - {simmedGame['scoreA']}"

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
                    otherGame.result = "L"
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
                    otherGame.result = "W"

                opponent.save()
                otherGame.save()
                Team.save()
                
            else:
                if otherGame.result == 'W':
                    game.result = 'L'
                else:
                    game.result = 'W'
                game.score = f"{otherGame.score.split('-')[1].strip()} - {otherGame.score.split('-')[0].strip()}"
                  
        else:
            simmedGame = simGame(game.gameID, Team.name, Team.rating, 'FCS', 50)
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
        game.save()

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

    context = {
        'team' : team,
        'conferences' : conferences,
        'weeks' : weeks
    }

    weeks.currentWeek += 1
    weeks.save()
    
    return HttpResponse(template.render(context, request))

def details(request, team, number):
    template = loader.get_template(f'game.html')

    conferences = Conferences.objects.all().order_by('confName')
    Team = Teams.objects.get(name=team)
    game = Games.objects.get(team=team, gameNum=number)
    opponentGame = Games.objects.get(team=game.opponent, opponent=team, weekPlayed=game.weekPlayed)

    if game.result != 'tbd':
        scores = {
            'team' : game.score.split('-')[0].strip(),
            'opponent' : game.score.split('-')[1].strip()
        }

        drives = list(Drives.objects.filter(gameID=game.gameID))
        drive_dicts = []
        
        for drive in drives:
            drive_dict = model_to_dict(drive)
            drive_dict['teamScoreAfter'] = 0
            drive_dict['opponentScoreAfter'] = 0
            drive_dicts.append(drive_dict)
        
        for i in range (len(drive_dicts)):
            if drive_dicts[i]['offense'] == game.team:
                if drive_dicts[i]['points']:
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['teamScoreAfter'] += drive_dicts[i]['points']
                elif drive_dicts[i]['result'] == 'safety':
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['opponentScoreAfter'] += 2
            elif drive_dicts[i]['offense'] == game.opponent:
                if drive_dicts[i]['points']:
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['opponentScoreAfter'] += drive_dicts[i]['points']
                elif drive_dicts[i]['result'] == 'safety':
                    for j in range(i, len(drive_dicts)):
                        drive_dicts[j]['teamScoreAfter'] += 2
                
        context = {
            'team' : Team,
            'opponent' : Teams.objects.get(name=game.opponent),
            'plays' : Plays.objects.filter(gameID=game.gameID),
            'game' : game,
            'drives' : drive_dicts,
            'scores' : scores,
            'opponentGame' : opponentGame,
            'conferences' : conferences
        }
    else:
        context = {
            'team' : Team,
            'opponent' : Teams.objects.get(name=game.opponent),
            'game' : game,
            'opponentGame' : opponentGame,
            'conferences' : conferences
        }
    
    return HttpResponse(template.render(context, request))

def getWinProb(teamARating, teamBRating):
    power = 15
    sum = (teamARating ** power) + (teamBRating ** power)
    teamAChance = (teamARating ** power) / sum
    return teamAChance

def setConferenceChampionships():
    conferences = Conferences.objects.all()

    for conference in conferences:
        teams = list(Teams.objects.filter(conference=conference.confName).order_by('-confWins', '-resume'))
        teamA = teams[0]
        teamB = teams[1]

        odds = getSpread(teamA.rating, teamB.rating)

        Games.objects.create(
            team = teamA.name,
            opponent = teamB.name,
            label = f"{conference.confName} championship",
            spread = odds['spreadA'],
            moneyline = odds['moneylineA'],
            winProb = odds['winProbA'],
            weekPlayed = 13,
            gameNum = 13,
            result = 'tbd'
        )
        Games.objects.create(
            team = teamB.name,
            opponent = teamA.name,
            label = f"{conference.confName} championship",
            spread = odds['spreadB'],
            moneyline = odds['moneylineB'],
            winProb = odds['winProbB'],
            weekPlayed = 13,
            gameNum = 13,
            result = 'tbd'
        )

def setPlayoff():
    teams = list(Teams.objects.order_by('-resume'))

    team1 = teams[0]
    team2 = teams[1]
    team3 = teams[2]
    team4 = teams[3]

    odds = getSpread(team1.rating, team4.rating)

    Games.objects.create(
        team = team1.name,
        opponent = team4.name,
        label = 'Playoff Semifinal 1v4',
        spread = odds['spreadA'],
        moneyline = odds['moneylineA'],
        winProb = odds['winProbA'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd'
    )
    Games.objects.create(
        team = team4.name,
        opponent = team1.name,
        label = 'Playoff Semifinal 4v1',
        spread = odds['spreadB'],
        moneyline = odds['moneylineB'],
        winProb = odds['winProbB'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd'
    )

    odds = getSpread(team2.rating, team3.rating)

    Games.objects.create(
        team = team2.name,
        opponent = team3.name,
        label = 'Playoff Semifinal 2v3',
        spread = odds['spreadA'],
        moneyline = odds['moneylineA'],
        winProb = odds['winProbA'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd'
    )
    Games.objects.create(
        team = team3.name,
        opponent = team2.name,
        label = 'Playoff Semifinal 3v2',
        spread = odds['spreadB'],
        moneyline = odds['moneylineB'],
        winProb = odds['winProbB'],
        weekPlayed = 14,
        gameNum = 14,
        result = 'tbd'
    )

def setNatty():
    teams = Games.objects.filter(result='W', label__startswith='Playoff Semifinal').values_list('team', flat=True)

    teamA = Teams.objects.get(name=teams[0])
    teamB = Teams.objects.get(name=teams[1])

    odds = getSpread(teamA.rating, teamB.rating)

    Games.objects.create(
        team = teamA.name,
        opponent = teamB.name,
        label = 'Natty',
        spread = odds['spreadA'],
        moneyline = odds['moneylineA'],
        winProb = odds['winProbA'],
        weekPlayed = 15,
        gameNum = 15,
        result = 'tbd'
    )
    Games.objects.create(
        team = teamB.name,
        opponent = teamA.name,
        label = 'Natty',
        spread = odds['spreadB'],
        moneyline = odds['moneylineB'],
        winProb = odds['winProbB'],
        weekPlayed = 15,
        gameNum = 15,
        result = 'tbd'
    )

def getAF(teamARating, teamBRating):
    power = 6.5
    sum = (teamARating ** power) + (teamBRating ** power)
    teamAAF = (teamARating ** power) / sum + 0.5
    return teamAAF

def simPass(comp):
    sack = 0.07
    int = 0.07

    result = {
        'outcome' : None,
        'yards' : None
    }

    if random.random() < sack: #sack
        result['outcome'] = 'sack'
        result['yards'] = sackYards()
    elif random.random() < comp: #completed pass
        result['outcome'] = 'completed pass'
        result['yards'] = passYards()
    elif random.random() < int: #int
        result['outcome'] = 'interception'
        result['yards'] = 0
    else: #incomplete pass
        result['outcome'] = 'incomplete'
        result['yards'] = 0

    return result

def simRun():
    fumble = 0.02

    result = {
        'outcome' : None,
        'yards' : None
    }

    if random.random() < fumble: #fumble
        result['outcome'] = 'fumble'
        result['yards'] = 0
    else: #regular run
        result['outcome'] = 'run'
        result['yards'] = runYards()

    return result

def passYards():
    sum = 0
    for i in range(5):
        sum += random.randint(-4, 9)

    return sum

def sackYards():
    sum = 0
    for i in range(4):
        sum += random.randint(-5, 2)
    
    return sum

def runYards():
    sum = 0
    for i in range(5):
        sum += random.randint(-3, 5)

    return sum

def simDrive(gameID, driveID, FP, teamAName, teamARating, teamBName, teamBRating):
    comp = 0.6
    passFreq = 0.5

    driveInfo = {
        'offense' : teamAName,
        'offenseRating' : teamARating,
        'defense' : teamBName,
        'defenseRating' : teamBRating,
        'startingFP' : FP,
        'result' : None,
        'points' : None,
        'plays' : [],
        'nextDriveFP' : None
    }

    yardsLeft = 0
    yardsGained = 0
    af = getAF(teamARating, teamBRating)

    while True:
        if driveInfo['result']: #end loop if a drive result has been found
            break

        for down in range(1, 5):
            play = {
                'FP' : FP,
                'down' : down,
                'yardsLeft' : None,
                'playType' : None,
                'yardsGained' : None,
                'result' : None
            }

            if down == 1:
                if FP >= 90: #check if first and goal
                    yardsLeft = 100 - FP
                else:
                    yardsLeft = 10
            elif down == 4: #4th down logic
                decision = fouthDown(FP, yardsLeft)
                
                if decision == 'field goal':
                    play['playType'] = 'field goal'
                    play['yardsGained'] = 0
                    play['result'] = 'field goal'
                    driveInfo['plays'].append(play)
                    driveInfo['result'] = 'field goal'
                    driveInfo['points'] = 3
                    driveInfo['nextDriveFP'] = 20
                    Plays.objects.create(
                        gameID = gameID,
                        driveID = driveID,
                        offense = teamAName,
                        defense = teamBName,
                        startingFP = FP,
                        down = down,
                        yardsLeft = yardsLeft,
                        playType = 'field goal',
                        yardsGained = 0,
                        result = 'field goal'
                    )
                    break
                elif decision == 'punt':
                    play['playType'] = 'punt'
                    play['yardsGained'] = 0
                    play['result'] = 'punt'
                    driveInfo['plays'].append(play)
                    driveInfo['result'] = 'punt'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - (FP + 40)
                    Plays.objects.create(
                        gameID = gameID,
                        driveID = driveID,
                        offense = teamAName,
                        defense = teamBName,
                        startingFP = FP,
                        down = down,
                        yardsLeft = yardsLeft,
                        playType = 'punt',
                        yardsGained = 0,
                        result = 'punt'
                    )
                    break
                
            play['yardsLeft'] = yardsLeft

            if random.random() < passFreq: #determine if pass or run occurs
                play['playType'] = 'pass'
                result = simPass(comp)

                if result['outcome'] == 'interception':
                    play['yardsGained'] = result['yards']
                    play['result'] = result['outcome']
                    driveInfo['plays'].append(play)
                    driveInfo['result'] = 'interception'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - FP
                    Plays.objects.create(
                        gameID = gameID,
                        driveID = driveID,
                        offense = teamAName,
                        defense = teamBName,
                        startingFP = FP,
                        down = down,
                        yardsLeft = yardsLeft,
                        playType = 'pass',
                        yardsGained = 0,
                        result = 'interception'
                    )
                    break
                else:
                    if result['yards'] > 0:
                        yardsGained = round(result['yards'] * af)
                    else:
                        yardsGained = round(result['yards'] * (1/af))
                    
                    if yardsGained + FP > 100: #adjust if touchdown
                        yardsGained = 100 - FP

                play['yardsGained'] = yardsGained
                play['result'] = result['outcome']
                driveInfo['plays'].append(play)
                Plays.objects.create(
                    gameID = gameID,
                    driveID = driveID,
                    offense = teamAName,
                    defense = teamBName,
                    startingFP = FP,
                    down = down,
                    yardsLeft = yardsLeft,
                    playType = 'pass',
                    yardsGained = yardsGained,
                    result = 'pass'
                )
            else: # if run
                play['playType'] = 'run'
                result = simRun()

                if result['outcome'] == 'fumble':
                    play['yardsGained'] = result['yards']
                    play['result'] = result['outcome']
                    driveInfo['plays'].append(play)
                    driveInfo['result'] = 'fumble'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - FP
                    Plays.objects.create(
                        gameID = gameID,
                        driveID = driveID,
                        offense = teamAName,
                        defense = teamBName,
                        startingFP = FP,
                        down = down,
                        yardsLeft = yardsLeft,
                        playType = 'run',
                        yardsGained = 0,
                        result = 'fumble'
                    )
                    break
                else:
                    if result['yards'] > 0:
                        yardsGained = round(result['yards'] * af)
                    else:
                        yardsGained = round(result['yards'] * (1/af))
                    
                    if yardsGained + FP > 100: #adjust if touchdown
                        yardsGained = 100 - FP
                    
                play['yardsGained'] = yardsGained
                play['result'] = result['outcome']
                driveInfo['plays'].append(play)
                Plays.objects.create(
                    gameID = gameID,
                    driveID = driveID,
                    offense = teamAName,
                    defense = teamBName,
                    startingFP = FP,
                    down = down,
                    yardsLeft = yardsLeft,
                    playType = 'run',
                    yardsGained = yardsGained,
                    result = 'run'
                )
            
            yardsLeft -= yardsGained
            FP += yardsGained

            if FP >= 100:
                driveInfo['result'] = 'touchdown'
                driveInfo['points'] = 7
                driveInfo['nextDriveFP'] = 20
                break
            elif down == 4 and yardsLeft > 0:
                driveInfo['result'] = 'turnover on downs'
                driveInfo['points'] = 0
                driveInfo['nextDriveFP'] = 100 - FP
                break
            elif FP < 1:
                driveInfo['result'] = 'safety'
                driveInfo['points'] = 0
                driveInfo['nextDriveFP'] = 20
                break
            
            if yardsLeft <= 0: #new set of downs if first down has been made
                break
            
    return driveInfo

def fouthDown(FP, yardsLeft):
    if FP < 40:
        return 'punt'
    elif (FP < 60):
        if yardsLeft < 5:
            return 'go'
        else:
            return 'punt'
    elif (FP < 70):
        if yardsLeft < 3:
            return 'go'
        else:
            return 'field goal'
    else:
        if yardsLeft < 5:
            return 'go'
        else:
            return 'field goal'

def simGame(gameID, teamAName, teamARating, teamBName, teamBRating):
    game = {
        'teamAName' : teamAName,
        'teamARating' : teamARating,
        'teamBName' : teamBName,
        'teamBRating' : teamBRating,
        'scoreA' : 0,
        'scoreB' : 0, 
        'drives' : [],
        'overtime' : False,
        'winner' : None
    }

    FP = None

    for i in range(22):
        if i == 0 or i == 11:
            FP = 20
        if i % 2 == 0:
            drive = simDrive(gameID, i, FP, teamAName, teamARating, teamBName, teamBRating)

            Drives.objects.create(
                gameID = gameID,
                driveID = i,
                offense = teamAName,
                defense = teamBName,
                startingFP = FP,
                result = drive['result'],
                yards = sum(play['yardsGained'] for play in drive['plays']),
                playCount = len(drive['plays']),
                points = drive['points']
            )

            game['drives'].append(drive)
            FP = drive['nextDriveFP']
        else:
            drive = simDrive(gameID, i, FP, teamBName, teamBRating, teamAName, teamARating)

            Drives.objects.create(
                gameID = gameID,
                driveID = i,
                offense = teamBName,
                defense = teamAName,
                startingFP = FP,
                result = drive['result'],
                yards = sum(play['yardsGained'] for play in drive['plays']),
                playCount = len(drive['plays']),
                points = drive['points']
            )

            game['drives'].append(drive)
            FP = drive['nextDriveFP']

    for drive in game['drives']:
        if drive['offense'] == teamAName:
            if drive['result'] != 'safety':
                game['scoreA'] += drive['points']
            else:
                game['scoreB'] += 2
            drive['scoreAAfter'] = game['scoreA']
            drive['scoreBAfter'] = game['scoreB']
        else:
            if drive['result'] != 'safety':
                game['scoreB'] += drive['points']
            else:
                game['scoreA'] += 2
            drive['scoreAAfter'] = game['scoreA']
            drive['scoreBAfter'] = game['scoreB']

    if game['scoreA'] == game['scoreB']:
        game['overtime'] = True
        game = overtime(gameID, game, teamAName, teamARating, teamBName, teamBRating)
    
    if game['scoreA'] > game['scoreB']:
        game['winner'] = teamAName
    else:
        game['winner'] = teamBName

    return game

def overtime(gameID, game, teamAName, teamARating, teamBName, teamBRating):
    i = 23
    while game['scoreA'] == game['scoreB']:
        drive = simDrive(gameID, i, 50, teamAName, teamARating, teamBName, teamBRating)
        game['scoreA'] += drive['points']
        drive['scoreAAfter'] = game['scoreA']
        drive['scoreBAfter'] = game['scoreB']
        game['drives'].append(drive)
        i += 1

        drive = simDrive(gameID, i, 50, teamBName, teamBRating, teamAName, teamARating)
        game['scoreB'] += drive['points']
        drive['scoreAAfter'] = game['scoreA']
        drive['scoreBAfter'] = game['scoreB']
        game['drives'].append(drive)
        i += 1 

    return game

def getSpread(teamARating, teamBRating, tax_factor=0.05):
    tests = 50
    aWin = 0
    bWin = 0
    aPoints = 0
    bPoints = 0

    for i in range(tests):
        game = simGame('teamA', teamARating, 'teamB', teamBRating)

        aPoints += game['scoreA']
        bPoints += game['scoreB']

        if game['winner'] == 'teamA':
            aWin += 1
        else:
            bWin += 1

    aPoints /= tests
    bPoints /= tests

    spread = round((bPoints - aPoints) * 2) / 2  # round to nearest half-point

    if spread > 0:
        spreadA = '+' + str(int(spread)) if spread.is_integer() else '+' + str(spread)
        spreadB = '-' + str(int(spread)) if spread.is_integer() else '-' + str(spread)
    elif spread < 0:
        spreadA = '-' + str(abs(int(spread))) if spread.is_integer() else '-' + str(abs(spread))
        spreadB = '+' + str(abs(int(spread))) if spread.is_integer() else '+' + str(abs(spread))
    else:
        spreadA = 'Even'
        spreadB = 'Even'

    winProbA = aWin / tests
    winProbB = bWin / tests
    
    implied_probA = winProbA + tax_factor / 2
    implied_probB = winProbB + tax_factor / 2

    if implied_probA >= 1:
        implied_probA = 0.99
    elif implied_probA <= 0:
        implied_probA = 0.01
    if implied_probB >= 1:
        implied_probB = 0.99
    elif implied_probB <= 0:
        implied_probB = 0.01
       
    if implied_probA > 0.5:
        moneylineA = round(implied_probA / (1 - implied_probA) * 100)
        moneylineA = f'-{moneylineA}'
    else:
        moneylineA = round(((1 / implied_probA) - 1) * 100)
        moneylineA = f'+{moneylineA}'

    if implied_probB > 0.5:
        moneylineB = round(implied_probB / (1 - implied_probB) * 100)
        moneylineB = f'-{moneylineB}'
    else:
        moneylineB = round(((1 / implied_probB) - 1) * 100)
        moneylineB = f'+{moneylineB}'
    
    return {
        'spreadA': spreadA,
        'spreadB': spreadB,
        'winProbA': winProbA,
        'winProbB': winProbB,
        'moneylineA': moneylineA,
        'moneylineB': moneylineB
    }
