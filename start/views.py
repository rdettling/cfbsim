from django.shortcuts import render
import json
import random
from .models import *
import static.code.names as names
import static.code.simtest as simtest
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
    players_to_create = []

    for conference in data['conferences']:
        Conference = Conferences(
            info = info,
            confName = conference['confName'],
            confFullName = conference['confFullName'],
            confGames = conference['confGames']
        )
        conferences_to_create.append(Conference)

        for team in conference['teams']:
            Team = Teams(
                info = info,
                name = team['name'],
                abbreviation = team['abbreviation'],
                prestige = team['prestige'],
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
                resume_total = 0,
                resume = 0,
                expectedWins = 0,
                ranking = 0
            )
            team = {
                'name' : team['name'],
                'prestige' : team['prestige'],
                'conference' : conference['confName'],
                'schedule' : set(),   
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
        Team = Teams(
            info = info,
            name = team['name'],
            abbreviation = team['abbreviation'],
            prestige = team['prestige'],
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
            resume_total = 0,
            resume = 0,
            expectedWins = 0,
            ranking = 0
        )
        team = {
            'name' : team['name'],
            'prestige' : team['prestige'],
            'conference' : None,
            'schedule' : set(),
            'confGames' : 0,
            'confLimit' : 0,
            'nonConfGames' : 0,
            'nonConfLimit' : 12,
            'gamesPlayed' : 0,
            'gameNum' : 1
        }
        
        teams_to_create.append(Team)
        data['teams'].append(team)

    FCS = Teams(
        info=info,
        name = 'FCS',
        abbreviation = 'FCS',
        prestige = 50,
        mascot = 'FCS',
        colorPrimary = '#000000',
        colorSecondary = '#FFFFFF',
        conference = None,
        confWins = 0,
        confLosses = 0,
        nonConfWins = 0,
        nonConfLosses = 0,
        totalWins = 0,
        totalLosses = 0,
        resume_total = 0,
        resume = 0,
        expectedWins = 0,
        ranking = 0
    )
    fcs = {
        'name' : 'FCS',
        'prestige' : 50,
        'conference' : None,
        'schedule' : set(),
        'confGames' : 0,
        'confLimit' : 0,
        'nonConfGames' : 0,
        'nonConfLimit' : 100,
        'gamesPlayed' : 0,
        'gameNum' : 1
    }
    teams_to_create.append(FCS)
    data['teams'].append(fcs)

    for team in teams_to_create:
        players(info, team, players_to_create) 

    teams_to_create = sorted(teams_to_create, key=lambda team: team.rating, reverse=True)
    for i, team in enumerate(teams_to_create, start=1):
        team.ranking = i

    odds_list = simtest.getSpread(teams_to_create[0].rating - teams_to_create[-1].rating) 

    with transaction.atomic():
        Conferences.objects.bulk_create(conferences_to_create)
        Teams.objects.bulk_create(teams_to_create)
        Players.objects.bulk_create(players_to_create)

    setSchedules(data, info, odds_list)

def setSchedules(data, info, odds_list):
    random.shuffle(data['teams'])
    games_to_create = []  
    scheduled_games = uniqueGames(info, data, games_to_create, odds_list)

    for team in data['teams']:
        if not team['conference'] and team['name'] != 'FCS':
            Team = Teams.objects.get(info=info, name=team['name'])
            
            done = False
            while team['nonConfGames'] < team['nonConfLimit']:
                for i in range(2):
                    for opponent in data['teams']:
                        if team['nonConfGames'] == team['nonConfLimit']:
                            done = True
                            break
                        if opponent['nonConfGames'] < opponent['nonConfLimit'] and opponent['name'] not in team['schedule'] and opponent['name'] != team['name'] and opponent['nonConfGames'] == i and opponent['name'] != 'FCS':
                            Opponent = Teams.objects.get(info=info, name=opponent['name'])
                            team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create, odds_list)
                    if done:
                        break
        print(f'scheduling done for {team["name"]}')

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
                        if opponent['nonConfGames'] < opponent['nonConfLimit'] and opponent['name'] not in team['schedule'] and opponent['conference'] != team['conference'] and opponent['nonConfGames'] == i and opponent['name'] != 'FCS':
                            Opponent = Teams.objects.get(info=info, name=opponent['name'])
                            team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create, odds_list)
                    if done:
                        break

                if not done:
                    fcs = next((team for team in data['teams'] if team['name'] == 'FCS'), None)
                    FCS = Teams.objects.get(info=info, name='FCS')
                    team, fcs = scheduleGame(info, team, fcs, Team, FCS, games_to_create, odds_list)
                               
            done = False

            while team['confGames'] < team['confLimit']:
                for i in range(team['confLimit']):
                    for opponent in confTeams:
                        if team['confGames'] == team['confLimit']:
                            done = True
                            break
                        if opponent['confGames'] < opponent['confLimit'] and opponent['name'] not in team['schedule'] and opponent['name'] != team['name'] and opponent['confGames'] == i:
                            Opponent = Teams.objects.get(info=info, name=opponent['name'])
                            team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create, odds_list)
                    if done:
                        break

        print(f'scheduling done for {team["name"]}')
    
    for currentWeek in range(1, 13):
        for team in data['teams']:
            if team['name'] in scheduled_games:
                if currentWeek in scheduled_games[team['name']]:
                    team['gamesPlayed'] += 1
        for team in sorted(data['teams'], key=lambda team: team['prestige'], reverse=True):
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

def players(info, team, players_to_create):
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

    variance = 15
    years = ['fr', 'so', 'jr', 'sr']

    # You can adjust these values or make them dynamic if needed.
    progression = {
        'fr': 0,     # Freshman usually start at their initial rating.
        'so': 3,     # Sophomores progress by 3 points.
        'jr': 6,     # Juniors progress by 6 points.
        'sr': 9      # Seniors progress by 9 points.
    }

    all_players = []  # Use this to keep track of all players before adding to players_to_create

    for position, count in roster.items():
        position_players = []  # Keep track of players for this specific position

        for i in range(2 * count + 1):
            first, last = names.generateName(position)
            year = random.choice(years)
            
            base_rating = team.prestige - random.randint(0, variance) - 5
            progressed_rating = base_rating + progression[year]
            
            player = Players(
                info=info,
                team=team,
                first=first,
                last=last,
                year=year,
                pos=position,
                rating=progressed_rating,
                starter=False
            )

            position_players.append(player)

        # Sort position_players by rating in descending order and set top players as starters
        position_players.sort(key=lambda x: x.rating, reverse=True)
        for i in range(roster[position]):
            position_players[i].starter = True

        all_players.extend(position_players)

    # Define positions categorically.
    offensive_positions = ['qb', 'rb', 'wr', 'te', 'ol']
    defensive_positions = ['dl', 'lb', 'cb', 's']

    offensive_weights = {
        'qb': 35,     
        'rb': 10,    
        'wr': 25,   
        'te': 10,     
        'ol': 20     
    }

    defensive_weights = {
        'dl': 35,     
        'lb': 20,   
        'cb': 30,   
        's': 15     
    }

    # Extract starters from all_players.
    offensive_starters = [player for player in all_players if player.pos in offensive_positions and player.starter]
    defensive_starters = [player for player in all_players if player.pos in defensive_positions and player.starter]

    # Compute the weighted average ratings.
    team.offense = round(sum(player.rating * offensive_weights[player.pos] for player in offensive_starters) / sum(offensive_weights[player.pos] for player in offensive_starters)) if offensive_starters else 0
    team.defense = round(sum(player.rating * defensive_weights[player.pos] for player in defensive_starters) / sum(defensive_weights[player.pos] for player in defensive_starters)) if defensive_starters else 0

    # Set the weights for offense and defense
    offense_weight = 0.60
    defense_weight = 0.40

    # Calculate the team rating
    team.rating = round((team.offense * offense_weight) + (team.defense * defense_weight))

    players_to_create.extend(all_players)

def scheduleGame(info, team, opponent, Team, Opponent, games_to_create, odds_list, weekPlayed=None, gameName=None):
    odds = odds_list[abs(Team.rating - Opponent.rating)]

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

    is_teamA_favorite = True  # Default to true

    if Opponent.rating > Team.rating:
        is_teamA_favorite = False

    game = Games(
        info=info,
        teamA=Team,
        teamB=Opponent,
        labelA=labelA,
        labelB=labelB,
        spreadA=odds['favSpread'] if is_teamA_favorite or Team.rating == Opponent.rating else odds['udSpread'],
        spreadB=odds['udSpread'] if is_teamA_favorite or Team.rating == Opponent.rating else odds['favSpread'],
        moneylineA=odds['favMoneyline'] if is_teamA_favorite or Team.rating == Opponent.rating else odds['udMoneyline'],
        moneylineB=odds['udMoneyline'] if is_teamA_favorite or Team.rating == Opponent.rating else odds['favMoneyline'],
        winProbA=odds['favWinProb'] if is_teamA_favorite or Team.rating == Opponent.rating else odds['udWinProb'],
        winProbB=odds['udWinProb'] if is_teamA_favorite or Team.rating == Opponent.rating else odds['favWinProb'],
        weekPlayed=weekPlayed if weekPlayed else 0,
        gameNumA=team['gameNum'],
        gameNumB=opponent['gameNum'],
        rankATOG=Team.ranking,
        rankBTOG=Opponent.ranking,
        overtime=0
    )

    games_to_create.append(game) 
    team['gameNum'] += 1
    opponent['gameNum'] += 1
    team['schedule'].add(opponent['name'])
    opponent['schedule'].add(team['name'])

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

def uniqueGames(info, data, games_to_create, odds_list):
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
                        team, opponent = scheduleGame(info, team, opponent, Team, Opponent, games_to_create, odds_list, game_week, game[3])

    # Return the final dictionary of teams and the weeks they have games scheduled during
    return scheduled_games
