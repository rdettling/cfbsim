from django.shortcuts import render
import json
import random
from .models import *
import static.sim as sim
import static.names as names
from django.db import transaction

def launch(request):
    if not request.session.session_key:
        request.session.create()
      
    user_id = request.session.session_key

    try:
        info = Info.objects.get(user_id=user_id)
    except:
        info = None

    context = {
        'info': info
    }

    return render(request, 'launch.html', context)

def start(request):
    user_id = request.session.session_key   
    year = request.GET.get('year')
    
    init(year, user_id)

    info = Info.objects.get(user_id=user_id)       
    teams = list(Teams.objects.filter(info=info).order_by('-prestige'))

    context = {
        'teams' : teams,
    }
    
    return render(request, 'pickteam.html', context)

def init(year, user_id):
    Info.objects.filter(user_id=user_id).delete()
    info = Info.objects.create(user_id=user_id, currentWeek=1, currentYear=year)

    Teams.objects.filter(info=info).delete()
    Players.objects.filter(info=info).delete()
    Conferences.objects.filter(info=info).delete()
    Games.objects.filter(info=info).delete()
    Drives.objects.filter(info=info).delete()
    Plays.objects.filter(info=info).delete()

    metadataFile = open('static/years/' + year + '.json')
    
    data = json.load(metadataFile)
    data['teams'] = []

    teams_to_create = []
    conferences_to_create = []
    for conference in data['conferences']:
        Conference = Conferences(
            info=info,
            confName = conference['confName'],
            confFullName = conference['confFullName'],
            confGames = conference['confGames']
        )
        conferences_to_create.append(Conference)

        for team in conference['teams']:
            rating = team['prestige'] + random.randint(-5, 5)
            Team = Teams(
                info=info,
                name = team['name'],
                abbreviation = team['abbreviation'],
                prestige = team['prestige'],
                rating = rating,
                mascot = team['mascot'],
                colorPrimary = team['colorPrimary'],
                colorSecondary = team['colorSecondary'],
                conference = Conference,
                confWins = 0,
                confLosses = 0,
                nonConfWins = 0,
                nonConfLosses = 0,
                totalWins = 0,
                totalLosses = 0,
                resume = 0,
                expectedWins = 0,
                ranking = 0
            )
            team = {
                'name' : team['name'],
                'rating' : rating,
                'conference' : conference['confName'],
                'schedule' : [],   
                'confGames' : 0,
                'confLimit' : conference['confGames'],
                'nonConfGames' : 0,
                'nonConfLimit' : 12 - conference['confGames'],
                'gamesPlayed' : 0,
                'gameNum' : 1
            }

            teams_to_create.append(Team)
            data['teams'].append(team)

    for team in data['independents']:
        rating = team['prestige'] + random.randint(-5, 5)
        Team = Teams(
            info=info,
            name = team['name'],
            abbreviation = team['abbreviation'],
            prestige = team['prestige'],
            rating = rating,
            mascot = team['mascot'],
            colorPrimary = team['colorPrimary'],
            colorSecondary = team['colorSecondary'],
            conference = None,
            confWins = 0,
            confLosses = 0,
            nonConfWins = 0,
            nonConfLosses = 0,
            totalWins = 0,
            totalLosses = 0,
            resume = 0,
            expectedWins = 0,
            ranking = 0
        )
        team = {
            'name' : team['name'],
            'rating' : rating,
            'conference' : None,
            'schedule' : [],
            'confGames' : 0,
            'confLimit' : 0,
            'nonConfGames' : 0,
            'nonConfLimit' : 12,
            'gamesPlayed' : 0,
            'gameNum' : 1
        }
        
        teams_to_create.append(Team)
        data['teams'].append(team)

    # for team in data['teams']:
    #     players(team) 

    teams_to_create = sorted(teams_to_create, key=lambda team: team.rating, reverse=True)
    for i, team in enumerate(teams_to_create, start=1):
        team.ranking = i

    with transaction.atomic():
        Conferences.objects.bulk_create(conferences_to_create)
        Teams.objects.bulk_create(teams_to_create)

    setSchedules(data, info)


def setSchedules(data, info):
    random.shuffle(data['teams'])

    games_to_create = []  

    scheduled_games = uniqueGames(info, data, games_to_create)

    for team in data['teams']:
        if not team['conference']:
            Team = Teams.objects.get(info=info, name=team['name'])
            
            done = False
            while team['nonConfGames'] < team['nonConfLimit']:
                for i in range(2):
                    for opponent in data['teams']:
                        if team['nonConfGames'] == team['nonConfLimit']:
                            done = True
                            break
                        if opponent['nonConfGames'] < opponent['nonConfLimit'] and opponent['name'] not in team['schedule'] and opponent['name'] != team['name'] and opponent['nonConfGames'] == i:
                            Opponent = Teams.objects.get(info=info, name=opponent['name'])
                            team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create)
                    if done:
                        break

    random.shuffle(data['conferences'])

    for conference in data['conferences']:
        random.shuffle(conference['teams'])
        random.shuffle(data['teams'])

        confTeams = [team for team in data['teams'] if team['conference'] == conference['confName']]
        confTeams = sorted(confTeams, key=lambda team: team['confGames'], reverse=True)

        for team in confTeams:
            Team = Teams.objects.get(info=info, name=team['name'])
            
            done = False
            while team['nonConfGames'] < team['nonConfLimit']:
                for i in range(12):
                    for opponent in data['teams']:
                        if team['nonConfGames'] == team['nonConfLimit']:
                            done = True
                            break    
                        if opponent['nonConfGames'] < opponent['nonConfLimit'] and opponent['name'] not in team['schedule'] and opponent['conference'] != team['conference'] and opponent['nonConfGames'] == i:
                            Opponent = Teams.objects.get(info=info, name=opponent['name'])
                            team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create)
                    if done:
                        break

                if not done:
                    odds = sim.getSpread(Team.rating, 50)
                    print(team['name'], 'FCSSSSS\n')
                    team['gameNum'] += 1
                    team['nonConfGames'] += 1                    
            done = False

            while team['confGames'] < team['confLimit']:
                for i in range(team['confLimit']):
                    for opponent in confTeams:
                        if team['confGames'] == team['confLimit']:
                            done = True
                            break
                        if opponent['confGames'] < opponent['confLimit'] and opponent['name'] not in team['schedule'] and opponent['name'] != team['name'] and opponent['confGames'] == i:
                            Opponent = Teams.objects.get(info=info, name=opponent['name'])
                            team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create)
                    if done:
                        break
    
    for currentWeek in range(1, 13):
        for team in data['teams']:
            if team['name'] in scheduled_games:
                if currentWeek in scheduled_games[team['name']]:
                    team['gamesPlayed'] += 1
        for team in sorted(data['teams'], key=lambda team: team['rating'], reverse=True):
            if team['gamesPlayed'] < currentWeek:
                Team = Teams.objects.get(info=info, name=team['name'])
                filtered_games = [game for game in games_to_create if game.teamA == Team or game.teamB == Team]
                filtered_games = [game for game in filtered_games if game.weekPlayed == 0]
                for game in filtered_games:
                    if team['gamesPlayed'] >= currentWeek:
                        break
                    for opponent in data['teams']:
                        if game.teamA == Team:
                            if opponent['gamesPlayed'] < currentWeek and opponent['name'] == game.teamB.name:
                                game.weekPlayed = currentWeek
                                team['gamesPlayed'] += 1
                                opponent['gamesPlayed'] += 1
                        elif game.teamB == Team:
                            if opponent['gamesPlayed'] < currentWeek and opponent['name'] == game.teamA.name:
                                game.weekPlayed = currentWeek
                                team['gamesPlayed'] += 1
                                opponent['gamesPlayed'] += 1

    Games.objects.bulk_create(games_to_create)  

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


def scheduleGame(info, team, opponent, Team, Opponent, games_to_create, weekPlayed=None, gameName=None):
    odds = sim.getSpread(Team.rating, Opponent.rating)

    if Team.conference and Opponent.conference:
        if Team.conference == Opponent.conference:
            labelA = labelB = f'C ({Team.conference.confName})'
        else:
            labelA = f'NC ({Opponent.conference.confName})'
            labelB = f'NC ({Team.conference.confName})'
    elif not Team.conference and Opponent.conference:
        labelA = f'NC ({Opponent.conference.confName})'
        labelB = 'NC (Ind)'
    elif not Opponent.conference and Team.conference:
        labelA = 'NC (Ind)'
        labelB = f'NC ({Team.conference.confName})'
    else:
        labelA = 'NC (Ind)'
        labelB = 'NC (Ind)'

    if gameName:
        labelA = labelB = gameName

    if weekPlayed:
        game = Games(
            info=info,
            teamA=Team, 
            teamB=Opponent,    
            labelA=labelA,  
            labelB=labelB,     
            spreadA=odds['spreadA'],  
            spreadB=odds['spreadB'],
            moneylineA=odds['moneylineA'],  
            moneylineB=odds['moneylineB'],
            winProbA=odds['winProbA'],  
            winProbB=odds['winProbB'],
            weekPlayed=weekPlayed,
            gameNumA=team['gameNum'],
            gameNumB=opponent['gameNum'],
            overtime=0,
        )
    else:
        game = Games(
            info=info,
            teamA=Team, 
            teamB=Opponent,    
            labelA=labelA,  
            labelB=labelB,     
            spreadA=odds['spreadA'],  
            spreadB=odds['spreadB'],
            moneylineA=odds['moneylineA'],  
            moneylineB=odds['moneylineB'],
            winProbA=odds['winProbA'],  
            winProbB=odds['winProbB'],
            weekPlayed=0,
            gameNumA=team['gameNum'],
            gameNumB=opponent['gameNum'],
            overtime=0,
        )

    games_to_create.append(game) 
    team['gameNum'] += 1
    opponent['gameNum'] += 1
    team['schedule'].append(opponent['name'])
    opponent['schedule'].append(team['name'])

    if Team.conference:
        if Team.conference == Opponent.conference:
            team['confGames'] += 1
            opponent['confGames'] += 1
        else:
            team['nonConfGames'] += 1
            opponent['nonConfGames'] += 1
    else:
        team['nonConfGames'] += 1
        opponent['nonConfGames'] += 1

    return team, opponent

def uniqueGames(info, data, games_to_create):
    games = data['rivalries']
        
    # Initialize a dictionary to keep track of games each team has already scheduled
    scheduled_games = {}

    # For each game in the list of games
    for game in games:
        # For each team in the game (game[0] is the first team, game[1] is the second team)
        for team_name in [game[0], game[1]]:
            # If this team has not yet been added to the dictionary, add it with an empty set as its value
            if team_name not in scheduled_games:
                scheduled_games[team_name] = set()

        # If a week has been specified for this game (game[2] is not None)
        if game[2] is not None:
            # Add this week to the set of weeks during which each team has a game scheduled
            scheduled_games[game[0]].add(game[2])
            scheduled_games[game[1]].add(game[2])

    # Now, go through the games again to actually schedule them
    for game in games:
        # For each team in the list of all teams
        for team in data['teams']:
            # If this team is the first team in this game
            if team['name'] == game[0]:
                # Get the database object for this team
                Team = Teams.objects.get(info=info, name=game[0])
                # For each team in the list of all teams
                for opponent in data['teams']:
                    # If this team is the second team in this game
                    if opponent['name'] == game[1]:
                        # Get the database object for this team
                        Opponent = Teams.objects.get(info=info, name=game[1])
                        # If a week was not specified for this game
                        if game[2] is None:
                            # Choose a random week that neither team has a game scheduled during
                            game_week = random.choice(list(set(range(1, 13)) - scheduled_games[game[0]] - scheduled_games[game[1]]))
                        else:
                            # Use the week that was specified for this game
                            game_week = game[2]

                        # Add this week to the set of weeks during which each team has a game scheduled
                        scheduled_games[game[0]].add(game_week)
                        scheduled_games[game[1]].add(game_week)

                        # Schedule this game by calling scheduleGame function
                        team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create, game_week, game[3])

    # Return the final dictionary of teams and the weeks they have games scheduled during
    return scheduled_games
