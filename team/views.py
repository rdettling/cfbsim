from start.models import *
import static.code.sim as sim
from django.shortcuts import render
from django.db.models import Q
import random

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
    game_logs = GameLog.objects.filter(player=player)  # Query for the game logs

    cumulative_stats = {
        'pass_yards': 0,
        'pass_attempts': 0,
        'pass_completions': 0,
        'pass_touchdowns': 0,
        'pass_interceptions': 0,
        'rush_yards': 0,
        'rush_attempts': 0,
        'rush_touchdowns': 0,
        'receiving_yards': 0,
        'receiving_catches': 0,
        'receiving_touchdowns': 0,
        # ... (add all the other fields)
    }

    for game_log in game_logs:
        if game_log.game.teamA == player.team:
            game_log.opponent = game_log.game.teamB.name
            game_log.label = game_log.game.labelA
            game_log.gameNum = game_log.game.gameNumA
            if not game_log.game.overtime:
                game_log.result = f'{game_log.game.resultA} ({game_log.game.scoreA} - {game_log.game.scoreB})'
            else:
                if game_log.game.overtime == 1:
                    game_log.result = f'{game_log.game.resultA} ({game_log.game.scoreA} - {game_log.game.scoreB} OT)'
                else:
                    game_log.result = f'{game_log.game.resultA} ({game_log.game.scoreA} - {game_log.game.scoreB} {game_log.game.overtime}OT)'
        else:
            game_log.opponent = game_log.game.teamA.name
            game_log.label = game_log.game.labelB
            game_log.gameNum = game_log.game.gameNumB
            if not game_log.game.overtime:
                game_log.result = f'{game_log.game.resultB} ({game_log.game.scoreB} - {game_log.game.scoreA})'
            else:
                if game_log.game.overtime == 1:
                    game_log.result = f'{game_log.game.resultB} ({game_log.game.scoreB} - {game_log.game.scoreA} OT)'
                else:
                    game_log.result = f'{game_log.game.resultB} ({game_log.game.scoreB} - {game_log.game.scoreA} {game_log.game.overtime}OT)'

        for key in cumulative_stats.keys():
            cumulative_stats[key] += getattr(game_log, key, 0)

    # Calculate derived statistics
    if cumulative_stats['pass_attempts'] > 0:
        cumulative_stats['completion_percentage'] = round((cumulative_stats['pass_completions'] / cumulative_stats['pass_attempts']) * 100, 1)
        cumulative_stats['adjusted_pass_yards_per_attempt'] = round((cumulative_stats['pass_yards'] + (20 * cumulative_stats['pass_touchdowns']) - (45 * cumulative_stats['pass_interceptions'])) / cumulative_stats['pass_attempts'], 1)
        
        # Calculate Passer rating
        a = ((cumulative_stats['completion_percentage'] / 100) - 0.3) * 5
        b = ((cumulative_stats['pass_yards'] / cumulative_stats['pass_attempts']) - 3) * 0.25
        c = (cumulative_stats['pass_touchdowns'] / cumulative_stats['pass_attempts']) * 20
        d = 2.375 - ((cumulative_stats['pass_interceptions'] / cumulative_stats['pass_attempts']) * 25)
        
        cumulative_stats['passer_rating'] = round(((a + b + c + d) / 6) * 100, 1)
    else:
        cumulative_stats['completion_percentage'] = 0
        cumulative_stats['adjusted_pass_yards_per_attempt'] = 0
        cumulative_stats['passer_rating'] = 0

    if cumulative_stats['rush_attempts'] > 0:
        cumulative_stats['rush_yards_per_attempt'] = round(cumulative_stats['rush_yards'] / cumulative_stats['rush_attempts'], 1)
    else:
        cumulative_stats['rush_yards_per_attempt'] = 0
    
    if cumulative_stats['receiving_catches'] > 0:
        cumulative_stats['yards_per_reception'] = cumulative_stats['receiving_yards'] / cumulative_stats['receiving_catches']
    else:
        cumulative_stats['yards_per_reception'] = 0

    context = {
         'team' : team,
         'player' : player,
         'info' : info,
         'conferences' : conferences,
         'game_logs' : game_logs,  # Include the game logs in the context
         'cumulative_stats': cumulative_stats  # Include the cumulative stats in the context
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

def simWeek(request, team_name, weeks):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    resumeFactor = 1.5
    
    Team = Teams.objects.get(info=info, name=team_name)   
    conferences = Conferences.objects.filter(info=info).order_by('confName')

    drives_to_create = []
    plays_to_create = []
    teamGames = []

    desired_week = info.currentWeek + weeks

    while info.currentWeek < desired_week: 
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

        update_rankings(info)

        if info.currentWeek == 12:
            setConferenceChampionships(info)
        elif info.currentWeek == 13:
            setPlayoff(info)
        elif info.currentWeek == 14:
            setNatty(info)
        info.currentWeek += 1

    game_log_dict = {}

    # Initialize dictionaries to store starters by team
    rb_starters_by_team = {}
    qb_starters_by_team = {}
    wr_starters_by_team = {}

    for play in plays_to_create:
        game = play.game
        offense_team = play.offense

        # Fetch RB starters for the offensive team if not already in the dictionary
        if offense_team not in rb_starters_by_team:
            rb_starters_by_team[offense_team] = list(Players.objects.filter(team=offense_team, pos="rb", starter=True))
        runner = random.choice(rb_starters_by_team[offense_team])
        
        # Fetch QB and WR starters for the offensive team if not already in the dictionary
        if offense_team not in qb_starters_by_team:
            qb_starters_by_team[offense_team] = Players.objects.filter(team=offense_team, pos="qb", starter=True).first()
        if offense_team not in wr_starters_by_team:
            wr_starters_by_team[offense_team] = list(Players.objects.filter(team=offense_team, pos="wr", starter=True))
        
        if play.playType == 'run':
            game_log = get_game_log(info, runner, game, game_log_dict)
            update_game_log_for_run(play, game_log)
            game_log_dict[(runner, game)] = game_log
            format_play_text(play, runner)

        elif play.playType == 'pass':
            qb_starter = qb_starters_by_team[offense_team]
            receiver = random.choice(wr_starters_by_team[offense_team])

            qb_game_log = get_game_log(info, qb_starter, game, game_log_dict)
            receiver_game_log = get_game_log(info, receiver, game, game_log_dict)
            update_game_log_for_pass(play, qb_game_log, receiver_game_log)
            
            game_log_dict[(qb_starter, game)] = qb_game_log
            game_log_dict[(receiver, game)] = receiver_game_log
            
            format_play_text(play, qb_starter, receiver)

    Drives.objects.bulk_create(drives_to_create)
    Plays.objects.bulk_create(plays_to_create)
    field_names = [f.name for f in GameLog._meta.fields if not f.primary_key and not f.is_relation]
    GameLog.objects.bulk_update(list(game_log_dict.values()), field_names)
    info.save()

    context = {
        'team' : Team,
        'conferences' : conferences,
        'teamGames' : teamGames,
        'info' : info
    }
    
    return render(request, 'sim.html', context)

def update_rankings(info):
    teams = Teams.objects.filter(info=info)

    for team in teams:
        games_played = team.totalWins + team.totalLosses

        if games_played > 0:
            team.resume = round(team.resume_total / (games_played), 1)
        else:
            team.resume = 0

    sorted_teams = sorted(teams, key=lambda x: x.resume, reverse=True)
        
    for i, team in enumerate(sorted_teams, start=1):
        team.ranking = i
        team.save()

    games = Games.objects.filter(info=info)

    for game in games:
        if not game.winner:
            game.rankATOG = game.teamA.ranking
            game.rankBTOG = game.teamB.ranking
        
        game.save()

def details(request, team_name, game_num):
    user_id = request.session.session_key 
    info = Info.objects.get(user_id=user_id)

    conferences = Conferences.objects.filter(info=info).order_by('confName')
    team = Teams.objects.get(info=info, name=team_name)
    game = get_game_by_team_and_gamenum(info, team, game_num)
    drives = game.drives.all()

    game_logs = GameLog.objects.filter(game=game)

    # Initialize an empty dictionary to store categorized game log strings
    categorized_game_log_strings = {'Passing': [], 'Rushing': [], 'Receiving': []}

    for game_log in game_logs:
        player = game_log.player
        position = player.pos  # Assuming 'position' is a field on your 'Players' model
        team_name = player.team.name  # Assuming 'team' is a field on your 'Players' model
        
        if 'qb' in position.lower():
            qb_game_log_dict = {
                'player_id': player.id,  # Assuming 'id' is a field on your 'Players' model
                'team_name': team_name,
                'game_log_string': f"{player.first} {player.last} ({team_name} - QB): {game_log.pass_completions}/{game_log.pass_attempts} for {game_log.pass_yards} yards, {game_log.pass_touchdowns} TDs, {game_log.pass_interceptions} INTs"
            }
            categorized_game_log_strings['Passing'].append(qb_game_log_dict)

        if 'rb' in position.lower() or ('qb' in position.lower() and game_log.rush_attempts > 0):  # Include QBs with rushing attempts
            rush_game_log_dict = {
                'player_id': player.id,
                'team_name': team_name,
                'game_log_string': f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.rush_attempts} carries, {game_log.rush_yards} yards, {game_log.rush_touchdowns} TDs"
            }
            categorized_game_log_strings['Rushing'].append(rush_game_log_dict)

        if 'wr' in position.lower() or ('rb' in position.lower() and game_log.receiving_catches > 0):  # Include RBs with receptions
            recv_game_log_dict = {
                'player_id': player.id,
                'team_name': team_name,
                'game_log_string': f"{player.first} {player.last} ({team_name} - {position.upper()}): {game_log.receiving_catches} catches, {game_log.receiving_yards} yards, {game_log.receiving_touchdowns} TDs"
            }
            categorized_game_log_strings['Receiving'].append(recv_game_log_dict)

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
        'stats' : stats,
        'categorized_game_log_strings' : categorized_game_log_strings
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
            rankATOG=teamA.ranking,
            rankBTOG=teamB.ranking
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
        rankATOG=team1.ranking,
        rankBTOG=team4.ranking
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
        rankATOG=team2.ranking,
        rankBTOG=team3.ranking
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

def get_game_log(info, player, game, game_log_dict):
    game_log_key = (player, game)
    return game_log_dict.get(game_log_key) or GameLog.objects.get_or_create(info=info, player=player, game=game)[0]

def update_game_log_for_run(play, game_log):
    game_log.rush_attempts += 1
    game_log.rush_yards += play.yardsGained
    if play.result == 'touchdown':
        game_log.rush_touchdowns += 1
    elif play.result == 'fumble':
        game_log.fumbles += 1

def update_game_log_for_pass(play, qb_game_log, receiver_game_log):
    qb_game_log.pass_attempts += 1
    if play.result in ['pass', 'touchdown']:
        qb_game_log.pass_completions += 1
        qb_game_log.pass_yards += play.yardsGained
        receiver_game_log.receiving_yards += play.yardsGained
        receiver_game_log.receiving_catches += 1
        if play.result == 'touchdown':
            qb_game_log.pass_touchdowns += 1
            receiver_game_log.receiving_touchdowns += 1
    elif play.result == 'interception':
        qb_game_log.pass_interceptions += 1

def format_play_text(play, player1, player2=None):
    if play.playType == 'run':
        if play.result == 'fumble':
            play.text = f"{player1.first} {player1.last} fumbled"
        elif play.result == 'touchdown':
            play.text = f"{player1.first} {player1.last} ran {play.yardsGained} yards for a touchdown"
        else:
            play.text = f"{player1.first} {player1.last} ran for {play.yardsGained} yards"

    elif play.playType == 'pass':
        if play.result == 'sack':
            play.text = f"{player1.first} {player1.last} was sacked for a loss of {play.yardsGained} yards"
        elif play.result == 'touchdown':
            play.text = f"{player1.first} {player1.last} completed a pass to {player2.first} {player2.last} for {play.yardsGained} yards resulting in a touchdown"
        elif play.result == 'pass':
            play.text = f"{player1.first} {player1.last} completed a pass to {player2.first} {player2.last} for {play.yardsGained} yards"
        elif play.result == 'interception':
            play.text = f"{player1.first} {player1.last}'s pass was intercepted"
        elif play.result == 'incomplete pass':
            play.text = f"{player1.first} {player1.last}'s pass was incomplete"

