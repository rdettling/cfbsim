import random
from statistics import mean
from pymongo import MongoClient

passFreq = 0.5
comp = 0.6
sack = 0.07
fumble = 0.02
interception = 0.07

def getAF(teamARating, teamBRating):
    power = 6.5
    sum = (teamARating ** power) + (teamBRating ** power)
    teamAAF = (teamARating ** power) / sum + 0.5
    return teamAAF

def getWinProb(teamARating, teamBRating):
    power = 15
    sum = (teamARating ** power) + (teamBRating ** power)
    teamAChance = (teamARating ** power) / sum
    return teamAChance

def simPass(comp):
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
    elif random.random() < interception: #interception
        result['outcome'] = 'interception'
        result['yards'] = 0
    else: #incomplete pass
        result['outcome'] = 'incomplete'
        result['yards'] = 0

    return result

def simRun():
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

def testYards():
    tests = 10000
    array = []
    
    for i in range(tests):
        array.append(runYards())

    array.sort()

    print(array[1000])
    print(array[2000])
    print(array[3000])
    print(array[4000])
    print(array[5000])
    print(array[6000])
    print(array[7000])
    print(array[8000])
    print(array[9000])
    print(mean(array))

def simDrive(FP, teamAName, teamARating, teamBName, teamBRating):
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
                    break
                elif decision == 'punt':
                    play['playType'] = 'punt'
                    play['yardsGained'] = 0
                    play['result'] = 'punt'
                    driveInfo['plays'].append(play)
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
                    driveInfo['plays'].append(play)
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
                driveInfo['plays'].append(play)
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
        else:
            if drive['result'] != 'safety':
                game['scoreB'] += drive['points']
            else:
                game['scoreA'] += 2

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
        game['drives'].append(drive)
        game['scoreA'] += drive['points']

        drive = simDrive(50, teamBName, teamBRating, teamAName, teamARating)
        game['drives'].append(drive)
        game['scoreB'] += drive['points']

    return game

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

def getSpread(teamARating, teamBRating, tax_factor=0.05):
    tests = 100
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

    if winProbA == 1:
        winProbA -= 0.01
        winProbB += 0.01
    elif winProbB == 1:
        winProbB -= 0.01
        winProbA += 0.01
    
    if winProbA == 0.5 and winProbB == 0.5:
        moneylineA = '-110'
        moneylineB = '-110'
    else:
        implied_probA = winProbA + tax_factor / 2
        implied_probB = winProbB + tax_factor / 2

        if winProbA > winProbB:
            moneylineA = round(implied_probA / (1 - implied_probA) * 100)
            moneylineB = round(((1 / implied_probB) - 1) * 100)

            moneylineA = f'-{moneylineA}'
            moneylineB = f'+{moneylineB}'
        else:
            moneylineA = round(((1 / implied_probA) - 1) * 100)
            moneylineB = round(implied_probB / (1 - implied_probB) * 100)

            moneylineA = f'+{moneylineA}'
            moneylineB = f'-{moneylineB}'
        
    return {
        'spreadA': spreadA,
        'spreadB': spreadB,
        'winProbA': winProbA,
        'winProbB': winProbB,
        'moneylineA': moneylineA,
        'moneylineB': moneylineB
    }
