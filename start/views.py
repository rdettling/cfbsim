from django.shortcuts import render
from django.http import HttpResponse
from django.template import loader
import json
import random
from .models import *

def launch(request):
    template = loader.get_template('launch.html')
    return HttpResponse(template.render())

def start(request):
    year = request.GET.get('year', '2023')

    init(year)

    teams = list(Teams.objects.all().order_by('-prestige'))

    context = {
        'teams' : teams,
    }
    
    template = loader.get_template('pickteam.html')
    return HttpResponse(template.render(context, request))

def init(year):
    Teams.objects.all().delete()
    Conferences.objects.all().delete()
    Games.objects.all().delete()
    Weeks.objects.all().delete()

    metadataFile = open('years/' + year + '.json')
    
    data = json.load(metadataFile)
    data['teams'] = []
    
    for conference in data['conferences']:
        Conferences.objects.create(
            confName = conference['confName'],
            confFullName = conference['confFullName'],
            confGames = conference['confGames']
        )

        for team in conference['teams']:
            Team = {
                'name' : team['name'],
                'abbreviation' : team['abbreviation'],
                'prestige' : team['prestige'],
                'rating' :  team['prestige'] + random.randint(-5, 5),
                'mascot' : team['mascot'],
                'colorPrimary' : team['colorPrimary'],
                'colorSecondary' : team['colorSecondary'],
                'conference' : conference['confName'],
                'expectedWins' : 0,
                'schedule' : 
                [
                    {
                        'gameNum' : 1,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 2,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 3,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 4,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 5,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 6,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 7,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 8,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 9,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 10,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 11,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 12,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    }
                ],      
                'confGames' : 0,
                'confLimit' : conference['confGames'],
                'nonConfGames' : 0,
                'nonConfLimit' : 12 - conference['confGames'],
                'gamesPlayed' : 0
            }

            data['teams'].append(Team)

    for team in data['independents']:
        Team = {
                'name' : team['name'],
                'abbreviation' : team['abbreviation'],
                'prestige' : team['prestige'],
                'rating' :  team['prestige'] + random.randint(-5, 5),
                'mascot' : team['mascot'],
                'colorPrimary' : team['colorPrimary'],
                'colorSecondary' : team['colorSecondary'],
                'conference' : None,
                'expectedWins' : 0,
                'schedule' : 
                [
                    {
                        'gameNum' : 1,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 2,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 3,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 4,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 5,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 6,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 7,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 8,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 9,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 10,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 11,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    },
                    {
                        'gameNum' : 12,
                        'weekPlayed' : None,
                        'opponent' : None,
                        'result' : 'tbd',
                        'label' : None
                    }
                ],      
                'confGames' : 0,
                'confLimit' : 0,
                'nonConfGames' : 0,
                'nonConfLimit' : 12,
                'gamesPlayed' : 0
            }

        data['teams'].append(Team)

    data = setSchedules(data)
    
    for team in data['teams']:
        Teams.objects.create(
            name = team['name'],
            abbreviation = team['abbreviation'],
            prestige = team['prestige'],
            rating = team['rating'],
            mascot = team['mascot'],
            colorPrimary = team['colorPrimary'],
            colorSecondary = team['colorSecondary'],
            conference = team['conference'],
            confWins = 0,
            confLosses = 0,
            nonConfWins = 0,
            nonConfLosses = 0,
            totalWins = 0,
            totalLosses = 0,
            resume = 0,
            expectedWins = team['expectedWins'],
            ranking = team['ranking']
        )        
        
    week = Weeks.objects.create(currentWeek=1)

def setSchedules(data):
    random.shuffle(data['teams'])

    gameID = 0

    for team in data['teams']:
        if not team['conference']:
            while team['nonConfGames'] < team['nonConfLimit']:
                for i in range(4):
                    for opponent in data['teams']:
                        if team['nonConfGames'] == team['nonConfLimit']:
                            done = True
                            break
                        if opponent['name'] != team['name'] and opponent['nonConfGames'] == i:
                            good = True
                            for week in team['schedule']:
                                if week['opponent'] == opponent['name']:
                                    good = False
                                    break
                            if good:
                                odds = getSpread(team['rating'], opponent['rating'])
                                for week in team['schedule']:
                                    if week['opponent'] == None:
                                        week['gameID'] = gameID
                                        week['opponent'] = opponent['name']
                                        week['abbreviation'] = opponent['abbreviation']
                                        week['rating'] = opponent['rating']
                                        week['label'] = opponent['conference']
                                        week['winProb'] = odds['winProbA']
                                        week['spread'] = odds['spreadA']
                                        week['moneyline'] = odds['moneylineA']
                                        team['nonConfGames'] += 1
                                        team['expectedWins'] += odds['winProbA']
                                        break
                                for week in opponent['schedule']:
                                    if week['opponent'] == None:
                                        week['gameID'] = gameID
                                        week['opponent'] = team['name']
                                        week['abbreviation'] = team['abbreviation']
                                        week['rating'] = team['rating']
                                        week['label'] = team['conference']
                                        week['winProb'] = odds['winProbB']
                                        week['spread'] = odds['spreadB']
                                        week['moneyline'] = odds['moneylineB']
                                        opponent['nonConfGames'] += 1
                                        opponent['expectedWins'] += odds['winProbB']
                                        break
                                gameID += 1
                    if done:
                        break

    random.shuffle(data['conferences'])

    for conference in data['conferences']:
        print(conference['confName'])
        random.shuffle(conference['teams'])
        random.shuffle(data['teams'])

        confTeams = [team for team in data['teams'] if team['conference'] == conference['confName']]


        for team in confTeams:
            while team['nonConfGames'] < team['nonConfLimit']:
                done = False 
                for i in range(team['nonConfLimit']):
                    for opponent in data['teams']:
                        if team['nonConfGames'] == team['nonConfLimit']:
                            done = True
                            break
                        if opponent['conference'] and opponent['conference'] != team['conference'] and opponent['nonConfGames'] == i:
                            good = True
                            for week in team['schedule']:
                                if week['opponent'] == opponent['name']:
                                    good = False
                                    break
                            if good:
                                odds = getSpread(team['rating'], opponent['rating'])
                                for week in team['schedule']:
                                    if week['opponent'] == None:
                                        week['gameID'] = gameID
                                        week['opponent'] = opponent['name']
                                        week['abbreviation'] = opponent['abbreviation']
                                        week['rating'] = opponent['rating']
                                        week['label'] = opponent['conference']
                                        week['winProb'] = odds['winProbA']
                                        week['spread'] = odds['spreadA']
                                        week['moneyline'] = odds['moneylineA']
                                        team['nonConfGames'] += 1
                                        team['expectedWins'] += odds['winProbA']
                                        break
                                for week in opponent['schedule']:
                                    if week['opponent'] == None:
                                        week['gameID'] = gameID
                                        week['opponent'] = team['name']
                                        week['abbreviation'] = team['abbreviation']
                                        week['rating'] = team['rating']
                                        week['label'] = team['conference']
                                        week['winProb'] = odds['winProbB']
                                        week['spread'] = odds['spreadB']
                                        week['moneyline'] = odds['moneylineB']
                                        opponent['nonConfGames'] += 1
                                        opponent['expectedWins'] += odds['winProbB']
                                        break
                                gameID += 1
                    if done:
                        break

                if not done:
                    odds = getSpread(team['rating'], 50)
                    for week in team['schedule']:
                        if week['opponent'] == None:
                            week['gameID'] = gameID
                            week['opponent'] = 'FCS'
                            week['abbreviation'] = 'FCS'
                            week['rating'] = 50
                            week['label'] = 'FCS'
                            week['winProb'] = odds['winProbA']
                            week['spread'] = odds['spreadA']
                            week['moneyline'] = odds['moneylineA']
                            team['nonConfGames'] += 1
                            team['expectedWins'] += odds['winProbA']
                            gameID += 1
                            break

            while team['confGames'] < team['confLimit']:
                done = False 
                for i in range(team['confLimit']):
                    for opponent in confTeams:
                        if team['confGames'] == team['confLimit']:
                            done = True
                            break
                        if opponent['name'] != team['name'] and opponent['confGames'] == i:
                            good = True
                            for week in team['schedule']:
                                if week['opponent'] == opponent['name']:
                                    good = False
                                    break
                            if good:
                                odds = getSpread(team['rating'], opponent['rating'])
                                for week in team['schedule']:
                                    if week['opponent'] == None:
                                        week['gameID'] = gameID
                                        week['opponent'] = opponent['name']
                                        week['abbreviation'] = opponent['abbreviation']
                                        week['rating'] = opponent['rating']
                                        week['label'] = opponent['conference']
                                        week['winProb'] = odds['winProbA']
                                        week['spread'] = odds['spreadA']
                                        week['moneyline'] = odds['moneylineA']
                                        team['confGames'] += 1
                                        team['expectedWins'] += odds['winProbA']
                                        break
                                for week in opponent['schedule']:
                                    if week['opponent'] == None:
                                        week['gameID'] = gameID
                                        week['opponent'] = team['name']
                                        week['abbreviation'] = team['abbreviation']
                                        week['rating'] = team['rating']
                                        week['label'] = team['conference']
                                        week['winProb'] = odds['winProbB']
                                        week['spread'] = odds['spreadB']
                                        week['moneyline'] = odds['moneylineB']
                                        opponent['confGames'] += 1
                                        opponent['expectedWins'] += odds['winProbB']
                                        break
                                gameID += 1
                    if done:
                        break
    
    for currentWeek in range(1, 13):
        for team in sorted(data['teams'], key=lambda team: team['rating'], reverse=True):
            if team['gamesPlayed'] < currentWeek:
                for week in team['schedule']:
                    if team['gamesPlayed'] == currentWeek:
                        break
                    if not week['weekPlayed']:
                        if week['opponent'] == 'FCS':
                            week['weekPlayed'] = currentWeek 
                        else:
                            for opponent in data['teams']:
                                if opponent['name'] == week['opponent']:
                                    if opponent['gamesPlayed'] < currentWeek:
                                        week['weekPlayed'] = currentWeek       
                                        team['gamesPlayed'] += 1
                                        opponent['gamesPlayed'] += 1
                                        for opponentWeek in opponent['schedule']:
                                            if opponentWeek['opponent'] == team['name']:
                                                opponentWeek['weekPlayed'] = currentWeek
       
    data['teams'] = sorted(data['teams'], key=lambda a: a['rating'], reverse=True) 
    for i in range(len(data['teams'])):
        data['teams'][i]['ranking'] = i+1
        data['teams'][i]['preseason'] = i+1
        data['teams'][i]['schedule'] = sorted(data['teams'][i]['schedule'], key=lambda week: week['weekPlayed'])

    for team in data['teams']:
        for week in team['schedule']:
            Games.objects.create(
                gameID = week['gameID'],
                team = team['name'],
                opponent = week['opponent'],
                label = week['label'],
                spread = week['spread'],
                moneyline = week['moneyline'],
                winProb = week['winProb'],
                weekPlayed = week['weekPlayed'],
                gameNum = week['gameNum'],
                result = week['result']
            )

    return data

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

def simDrive(FP, teamAName, teamARating, teamBName, teamBRating):
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
                    #driveInfo['plays'].append(play)
                    driveInfo['result'] = 'field goal'
                    driveInfo['points'] = 3
                    driveInfo['nextDriveFP'] = 20
                    break
                elif decision == 'punt':
                    play['playType'] = 'punt'
                    play['yardsGained'] = 0
                    play['result'] = 'punt'
                    #driveInfo['plays'].append(play)
                    driveInfo['result'] = 'punt'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - (FP + 40)
                    break
                
            play['yardsLeft'] = yardsLeft

            if random.random() < passFreq: #determine if pass or run occurs
                play['playType'] = 'pass'
                result = simPass(comp)

                if result['outcome'] == 'interception':
                    play['yardsGained'] = result['yards']
                    play['result'] = result['outcome']
                    #driveInfo['plays'].append(play)
                    driveInfo['result'] = 'interception'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - FP
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
                #driveInfo['plays'].append(play)
            else: # if run
                play['playType'] = 'run'
                result = simRun()

                if result['outcome'] == 'fumble':
                    play['yardsGained'] = result['yards']
                    play['result'] = result['outcome']
                    #driveInfo['plays'].append(play)
                    driveInfo['result'] = 'fumble'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - FP
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
                #driveInfo['plays'].append(play)
            
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

def simGame(teamAName, teamARating, teamBName, teamBRating):
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
            drive = simDrive(FP, teamAName, teamARating, teamBName, teamBRating)
            game['drives'].append(drive)
            FP = drive['nextDriveFP']
        else:
            drive = simDrive(FP, teamBName, teamBRating, teamAName, teamARating)
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
        game = overtime(game, teamAName, teamARating, teamBName, teamBRating)
    
    if game['scoreA'] > game['scoreB']:
        game['winner'] = teamAName
    else:
        game['winner'] = teamBName

    return game

def overtime(game, teamAName, teamARating, teamBName, teamBRating):
    while game['scoreA'] == game['scoreB']:
        drive = simDrive(50, teamAName, teamARating, teamBName, teamBRating)
        game['scoreA'] += drive['points']
        drive['scoreAAfter'] = game['scoreA']
        drive['scoreBAfter'] = game['scoreB']
        game['drives'].append(drive)

        drive = simDrive(50, teamBName, teamBRating, teamAName, teamARating)
        game['scoreB'] += drive['points']
        drive['scoreAAfter'] = game['scoreA']
        drive['scoreBAfter'] = game['scoreB']
        game['drives'].append(drive)

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
