from django.shortcuts import render
from django.http import HttpResponse
from django.template import loader
import json
import random
from .models import *
import static.sim as sim
import static.names as names

def launch(request):
    try:
        info = Info.objects.get()
    except:
        info = None

    context = {
        'info': info
    }

    return render(request, 'launch.html', context)

def start(request):
    year = request.GET.get('year')
    
    if year:
        init(year)

    teams = list(Teams.objects.all().order_by('-prestige'))

    context = {
        'teams' : teams,
    }
    
    template = loader.get_template('pickteam.html')
    return HttpResponse(template.render(context, request))

def init(year):
    try:
        Teams.objects.all().delete()
        Players.objects.all().delete()
        Conferences.objects.all().delete()
        Games.objects.all().delete()
        Info.objects.all().delete()
        Drives.objects.all().delete()
        Plays.objects.all().delete()
    except:
        pass

    Info.objects.create(currentWeek=1, currentYear=year)
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
        team = Teams.objects.create(
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

        players(team) 

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
                                odds = sim.getSpread(team['rating'], opponent['rating'])
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
                                odds = sim.getSpread(team['rating'], opponent['rating'])
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
                    odds = sim.getSpread(team['rating'], 50)
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
                                odds = sim.getSpread(team['rating'], opponent['rating'])
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

    print('done')
    
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
                result = week['result'],
                overtime = 0
            )

    return data

def players(team):
    roster = {
        'qb': 1,
        'rb': 1,
        'wr': 3,
        'te': 1,
        'ol': 5,
        'dl': 4,
        'lb': 3,
        'cb': 2,
        's': 2,
        'k' : 1,
        'p' : 1
    }

    for position, count in roster.items():
        for i in range(2 * count + 1):
            name = names.generateName(position)
            if i < count:
                Players.objects.create(
                    team = team,
                    first = name[0],
                    last = name[1],
                    pos = position,
                    starter = True
                )
            else:
                Players.objects.create(
                    team = team,
                    first = name[0],
                    last = name[1],
                    pos = position,
                    starter = False
                )
            if position == 'k' or position == 'p':
                break
