import random
from start.models import * 

def simPass(fieldPosition, offense, defense):
    comp = 0.62
    sack = 0.07
    int = 0.07

    result = {
        'outcome': None,
        'yards': None,
    }

    if random.random() < sack:  # sack
        result['outcome'] = 'sack'
        result['yards'] = sackYards(offense, defense)
    elif random.random() < comp:  # completed pass
        result['yards'] = passYards(offense, defense)

        if result['yards'] + fieldPosition >= 100:
            result['yards'] = 100 - fieldPosition
            result['outcome'] = 'touchdown'
        else:
            result['outcome'] = 'pass'

    elif random.random() < int:  # interception
        result['outcome'] = 'interception'
        result['yards'] = 0

    else:  # incomplete pass
        result['outcome'] = 'incomplete pass'
        result['yards'] = 0
     
    return result

def simRun(fieldPosition, offense, defense):
    fumble_chance = 0.02  

    result = {
        'outcome': None,
        'yards': None
    }

    if random.random() < fumble_chance:  # fumble
        result['outcome'] = 'fumble'
        result['yards'] = 0
    else:  
        result['yards'] = runYards(offense, defense)

        if result['yards'] + fieldPosition >= 100:
            result['yards'] = 100 - fieldPosition
            result['outcome'] = 'touchdown'
        else:
            result['outcome'] = 'run'

    return result

def passYards(offense, defense, base_mean=7.5, std_dev=7, advantage_factor=0.22):
    rating_difference = offense.offense - defense.defense
    advantage_yardage = rating_difference * advantage_factor
    mean_yardage = base_mean + advantage_yardage
    raw_yardage = random.gauss(mean_yardage, std_dev)  # simulating normal distribution
    
    if raw_yardage < 0:
        return round(raw_yardage / 3)
    else:
        return round(raw_yardage + (0.008 * (raw_yardage ** 2.7)))

def sackYards(offense, defense, base_mean=-6, std_dev=2, advantage_factor=0.10):
    rating_difference = offense.offense - defense.defense
    advantage_yardage = rating_difference * advantage_factor
    mean_yardage = base_mean + advantage_yardage
    raw_yardage = random.gauss(mean_yardage, std_dev)
    
    return round(min(raw_yardage, 0))

def runYards(offense, defense, base_mean=2.8, std_dev=5.5, advantage_factor=0.08):
    rating_difference = offense.offense - defense.defense
    advantage_yardage = rating_difference * advantage_factor
    mean_yardage = base_mean + advantage_yardage
    raw_yardage = random.gauss(mean_yardage, std_dev)
    
    if raw_yardage < 0:
        return round(raw_yardage)
    else:
        return round(raw_yardage + (0.00044 * (raw_yardage ** 4.2)))


def simDrive(info, game, driveNum, fieldPosition, offense, defense, plays_to_create):
    passFreq = 0.5

    drive = Drives(
        info = info,
        game = game,
        driveNum = driveNum,
        offense = offense,
        defense = defense,
        startingFP = fieldPosition,
        result = None,
        points = 0,
    )

    while not drive.result:
        for down in range(1, 5):
            play = Plays(
                info = info,
                game = game,
                drive = drive,
                offense = offense,
                defense = defense,
                startingFP = fieldPosition,
                down = down
            )
            if down == 1:
                if fieldPosition >= 90: #check if first and goal
                    yardsLeft = 100 - fieldPosition
                else:
                    yardsLeft = 10

            play.yardsLeft = yardsLeft

            if down == 4: #4th down logic
                decision = fouthDown(fieldPosition, yardsLeft)
            
                if decision == 'field goal':
                    play.playType = 'field goal attempt'
                    play.yardsGained = 0
                    play.result = 'made field goal'
                    plays_to_create.append(play)
                   
                    drive.result = 'field goal'
                    drive.points = 3
                    
                    return drive, 20
                
                elif decision == 'punt':
                    play.playType = 'punt'
                    play.yardsGained = 0
                    play.result = 'punt'
                    plays_to_create.append(play)

                    drive.result = 'punt'
                    drive.points = 0
                    
                    return drive, 100 - (fieldPosition + 40)

            if random.random() < passFreq: #determine if pass or run occurs if not doing special teams play
                result = simPass(fieldPosition, offense, defense)
                play.playType = 'pass'

                if result['outcome'] == 'interception':
                    play.yardsGained = 0
                    play.result = 'interception'
                    plays_to_create.append(play)

                    drive.result = 'interception'
                    drive.points = 0

                    return drive, 100 - fieldPosition
            
            else: # if run
                result = simRun(fieldPosition, offense, defense)
                play.playType = 'run'

                if result['outcome'] == 'fumble':
                    play.yardsGained = 0
                    play.result = 'fumble'
                    plays_to_create.append(play)

                    drive.result = 'fumble'
                    drive.points = 0

                    return drive, 100 - fieldPosition
                
            yardsGained = result['yards']
            
            if yardsGained + fieldPosition >= 100: #adjust if touchdown
                play.yardsGained = yardsGained
                play.result = result['outcome']
                plays_to_create.append(play)

                drive.result = 'touchdown'
                drive.points = 7

                return drive, 20
            
            yardsLeft -= yardsGained
            fieldPosition += yardsGained

            play.yardsGained = yardsGained
            play.result = result['outcome']
            plays_to_create.append(play)
            
            if down == 4 and yardsLeft > 0:
                drive.result = 'turnover on downs'
                drive.points = 0

                return drive, 100 - fieldPosition
            if fieldPosition < 1:
                drive.result = 'safety'
                drive.points = 0

                return drive, 20
               
            if yardsLeft <= 0: #new set of downs if first down has been made
                break

def fouthDown(fieldPosition, yardsLeft):
    if fieldPosition < 40:
        return 'punt'
    elif (fieldPosition < 60):
        if yardsLeft < 5:
            return 'go'
        else:
            return 'punt'
    elif (fieldPosition < 70):
        if yardsLeft < 3:
            return 'go'
        else:
            return 'field goal'
    else:
        if yardsLeft < 5:
            return 'go'
        else:
            return 'field goal'
        

def simGame(info, game, drives_to_create, plays_to_create, resumeFactor):
    drivesPerTeam = 12
    fieldPosition = None
    game.scoreA = 0
    game.scoreB = 0

    for i in range(drivesPerTeam * 2):
        if i == 0 or i == drivesPerTeam:
            fieldPosition = 20
        if i % 2 == 0:
            drive, fieldPosition = simDrive(info, game, i, fieldPosition, game.teamA, game.teamB, plays_to_create)

            if not drive.result == 'safety':
                game.scoreA += drive.points
            else:
                game.scoreB += 2
            drives_to_create.append(drive)
        else:
            drive, fieldPosition = simDrive(info, game, i, fieldPosition, game.teamB, game.teamA, plays_to_create)
            if not drive.result == 'safety':
                game.scoreB += drive.points
            else:
                game.scoreA += 2
            drives_to_create.append(drive)

    if game.scoreA == game.scoreB:
        game = overtime(info, game, drives_to_create, plays_to_create, drivesPerTeam)

    if game.scoreA > game.scoreB:
        if game.teamA.conference == game.teamB.conference:
            game.teamA.confWins += 1
            game.teamB.confLosses += 1
        else:
            game.teamA.nonConfWins += 1
            game.teamB.nonConfLosses += 1
        game.winner = game.teamA
        game.resultA = "W"
        game.resultB = "L"
        game.teamA.totalWins += 1
        game.teamB.totalLosses += 1
        game.teamA.resume_total += game.teamB.rating ** resumeFactor
    elif game.scoreA < game.scoreB:
        if game.teamA.conference == game.teamB.conference:
            game.teamA.confLosses += 1
            game.teamB.confWins += 1
        else:
            game.teamA.nonConfLosses += 1
            game.teamB.nonConfWins += 1
        game.winner = game.teamB
        game.resultA = "L"
        game.resultB = "W"
        game.teamA.totalLosses += 1
        game.teamB.totalWins += 1
        game.teamB.resume_total += game.teamA.rating ** resumeFactor

    game.save()
    game.teamA.save()
    game.teamB.save()

def overtime(info, game, drives_to_create, plays_to_create, drivesPerTeam):
    i = (drivesPerTeam * 2) + 1

    while game.scoreA == game.scoreB:
        game.overtime += 1

        i += 1
        drive, fieldPosition = simDrive(info, game, i, 50, game.teamA, game.teamB, plays_to_create)
        if not drive.result == 'safety':
                game.scoreA += drive.points
        else:
                game.scoreB += 2
        drives_to_create.append(drive)

        i += 1 
        drive, fieldPosition = simDrive(info, game, i, 50, game.teamB, game.teamA, plays_to_create)
        if not drive.result == 'safety':
                game.scoreB += drive.points
        else:
                game.scoreA += 2
        drives_to_create.append(drive)

    return game

def getSpread(teamARating, teamBRating, tax_factor=0.05):
    # tests = 50
    # aWin = 0
    # bWin = 0
    # aPoints = 0
    # bPoints = 0

    # for i in range(tests):
    #     game = simGame('teamA', teamARating, 'teamB', teamBRating)

    #     aPoints += game['scoreA']
    #     bPoints += game['scoreB']

    #     if game['winner'] == 'teamA':
    #         aWin += 1
    #     else:
    #         bWin += 1

    # aPoints /= tests
    # bPoints /= tests

    # spread = round((bPoints - aPoints) * 2) / 2  # round to nearest half-point

    # if spread > 0:
    #     spreadA = '+' + str(int(spread)) if spread.is_integer() else '+' + str(spread)
    #     spreadB = '-' + str(int(spread)) if spread.is_integer() else '-' + str(spread)
    # elif spread < 0:
    #     spreadA = '-' + str(abs(int(spread))) if spread.is_integer() else '-' + str(abs(spread))
    #     spreadB = '+' + str(abs(int(spread))) if spread.is_integer() else '+' + str(abs(spread))
    # else:
    #     spreadA = 'Even'
    #     spreadB = 'Even'

    # winProbA = aWin / tests
    # winProbB = bWin / tests
    
    # implied_probA = winProbA + tax_factor / 2
    # implied_probB = winProbB + tax_factor / 2

    # if implied_probA >= 1:
    #     implied_probA = 0.99
    # elif implied_probA <= 0:
    #     implied_probA = 0.01
    # if implied_probB >= 1:
    #     implied_probB = 0.99
    # elif implied_probB <= 0:
    #     implied_probB = 0.01
       
    # if implied_probA > 0.5:
    #     moneylineA = round(implied_probA / (1 - implied_probA) * 100)
    #     moneylineA = f'-{moneylineA}'
    # else:
    #     moneylineA = round(((1 / implied_probA) - 1) * 100)
    #     moneylineA = f'+{moneylineA}'

    # if implied_probB > 0.5:
    #     moneylineB = round(implied_probB / (1 - implied_probB) * 100)
    #     moneylineB = f'-{moneylineB}'
    # else:
    #     moneylineB = round(((1 / implied_probB) - 1) * 100)
    #     moneylineB = f'+{moneylineB}'
    
    # return {
    #     'spreadA': spreadA,
    #     'spreadB': spreadB,
    #     'winProbA': winProbA,
    #     'winProbB': winProbB,
    #     'moneylineA': moneylineA,
    #     'moneylineB': moneylineB
    # }
    return {
        'spreadA': 0,
        'spreadB': 0,
        'winProbA': 0,
        'winProbB': 0,
        'moneylineA': 0,
        'moneylineB': 0
    }

def testGame(a, b):
    tests = 100
    aWin = 0
    aPoints = 0
    bWin = 0 
    bPoints = 0

    for i in range(tests):
        game = simGame('teamA', a, 'teamB', b)

        aPoints += game['scoreA']
        bPoints += game['scoreB']

        if game['winner'] == 'teamA':
            aWin += 1
        else:
            bWin += 1

    aPoints /= tests
    bPoints /= tests

    print(f"{aWin} - {bWin}")
    print(getWinProb(a, b))
    print(f"{aPoints} - {bPoints}")
    print(getSpread(a, b))

def getWinProb(teamARating, teamBRating):
    power = 15
    sum = (teamARating ** power) + (teamBRating ** power)
    teamAChance = (teamARating ** power) / sum
    return teamAChance

def fieldGoal(distance):
    if distance < 20:
        return True
    elif distance >= 20 and distance < 30:
        success_rate = 0.95 - (distance - 20) * 0.01
        return success_rate > random.random()
    elif distance >= 30 and distance < 40:
        success_rate = 0.85 - (distance - 30) * 0.02
        return success_rate > random.random()
    elif distance >= 40 and distance < 50:
        success_rate = 0.60 - (distance - 40) * 0.04
        return success_rate > random.random()
    elif distance >= 50 and distance < 60:
        success_rate = 0.30 - (distance - 50) * 0.05
        return success_rate > random.random()
    else:
        return False