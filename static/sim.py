import random
from start.models import * 

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
        result['outcome'] = 'incomplete pass'
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

def simDrive(driveID, fieldPosition, teamAName, teamARating, teamBName, teamBRating, gameID=None):
    driveInfo = {
        'offense' : teamAName,
        'defense' : teamBName,
        'result' : None,
        'points' : None,
        'nextDriveFP' : None,
        'yards' : 0,
        'playCount' : 0
    }

    comp = 0.6
    passFreq = 0.5
    af = getAF(teamARating, teamBRating)

    while True:
        if driveInfo['result']: #end loop if a drive result has been found
            break

        for down in range(1, 5):
            if down == 1:
                if fieldPosition >= 90: #check if first and goal
                    yardsLeft = 100 - fieldPosition
                else:
                    yardsLeft = 10
            elif down == 4: #4th down logic
                decision = fouthDown(fieldPosition, yardsLeft)
            
                if decision == 'field goal':
                    yardsGained = 0
                    driveInfo['yards'] += yardsGained
                    driveInfo['result'] = 'field goal'
                    driveInfo['points'] = 3
                    driveInfo['nextDriveFP'] = 20
                    driveInfo['playCount'] += 1
                    if gameID:
                        Plays.objects.create(
                            gameID = gameID,
                            driveID = driveID,
                            offense = teamAName,
                            defense = teamBName,
                            startingFP = fieldPosition,
                            down = down,
                            yardsLeft = yardsLeft,
                            playType = 'field goal',
                            yardsGained = yardsGained,
                            result = 'made field goal'
                        )
                    break
                elif decision == 'punt':
                    yardsGained = 0
                    driveInfo['yards'] += yardsGained
                    driveInfo['result'] = 'punt'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - (fieldPosition + 40)
                    driveInfo['playCount'] += 1
                    if gameID:
                        Plays.objects.create(
                            gameID = gameID,
                            driveID = driveID,
                            offense = teamAName,
                            defense = teamBName,
                            startingFP = fieldPosition,
                            down = down,
                            yardsLeft = yardsLeft,
                            playType = 'punt',
                            yardsGained = yardsGained,
                            result = 'punt'
                        )
                    break

            if random.random() < passFreq: #determine if pass or run occurs if not doing special teams play
                result = simPass(comp)
                yardsGained = result['yards']
                driveInfo['playCount'] += 1

                if result['outcome'] == 'interception':
                    driveInfo['result'] = 'interception'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - fieldPosition
                    if gameID:
                        Plays.objects.create(
                            gameID = gameID,
                            driveID = driveID,
                            offense = teamAName,
                            defense = teamBName,
                            startingFP = fieldPosition,
                            down = down,
                            yardsLeft = yardsLeft,
                            playType = 'pass',
                            yardsGained = yardsGained,
                            result = result['outcome']
                        )
                    break
                else:
                    if result['yards'] > 0:
                        yardsGained = round(result['yards'] * af)
                    else:
                        yardsGained = round(result['yards'] * (1/af))
                    
                    if yardsGained + fieldPosition > 100: #adjust if touchdown
                        yardsGained = 100 - fieldPosition
                    driveInfo['yards'] += yardsGained

                if gameID:
                    Plays.objects.create(
                        gameID = gameID,
                        driveID = driveID,
                        offense = teamAName,
                        defense = teamBName,
                        startingFP = fieldPosition,
                        down = down,
                        yardsLeft = yardsLeft,
                        playType = 'pass',
                        yardsGained = yardsGained,
                        result = result['outcome']
                    )
            else: # if run
                result = simRun()
                yardsGained = result['yards']
                driveInfo['playCount'] += 1

                if result['outcome'] == 'fumble':
                    driveInfo['result'] = 'fumble'
                    driveInfo['points'] = 0
                    driveInfo['nextDriveFP'] = 100 - fieldPosition
                    if gameID:
                        Plays.objects.create(
                            gameID = gameID,
                            driveID = driveID,
                            offense = teamAName,
                            defense = teamBName,
                            startingFP = fieldPosition,
                            down = down,
                            yardsLeft = yardsLeft,
                            playType = 'run',
                            yardsGained = yardsGained,
                            result = result['outcome']
                        )
                    break
                else:
                    if result['yards'] > 0:
                        yardsGained = round(result['yards'] * af)
                    else:
                        yardsGained = round(result['yards'] * (1/af))
                    
                    if yardsGained + fieldPosition > 100: #adjust if touchdown
                        yardsGained = 100 - fieldPosition
                    driveInfo['yards'] += yardsGained
                    
                if gameID:
                    Plays.objects.create(
                        gameID = gameID,
                        driveID = driveID,
                        offense = teamAName,
                        defense = teamBName,
                        startingFP = fieldPosition,
                        down = down,
                        yardsLeft = yardsLeft,
                        playType = 'run',
                        yardsGained = yardsGained,
                        result = result['outcome']
                    )
            
            yardsLeft -= yardsGained
            fieldPosition += yardsGained

            if fieldPosition >= 100:
                driveInfo['result'] = 'touchdown'
                driveInfo['points'] = 7
                driveInfo['nextDriveFP'] = 20
                break
            elif down == 4 and yardsLeft > 0:
                driveInfo['result'] = 'turnover on downs'
                driveInfo['points'] = 0
                driveInfo['nextDriveFP'] = 100 - fieldPosition
                break
            elif fieldPosition < 1:
                driveInfo['result'] = 'safety'
                driveInfo['points'] = 0
                driveInfo['nextDriveFP'] = 20
                break
            
            if yardsLeft <= 0: #new set of downs if first down has been made
                break
            
    return driveInfo

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

def simGame(teamAName, teamARating, teamBName, teamBRating, gameID=None):
    drivesPerTeam = 11
    fieldPosition = None

    game = {
        'teamAName' : teamAName,
        'teamARating' : teamARating,
        'teamBName' : teamBName,
        'teamBRating' : teamBRating,
        'scoreA' : 0,
        'scoreB' : 0, 
        'drives' : [],
        'overtime' : 0,
        'winner' : None
    }

    for i in range(drivesPerTeam * 2):
        if i == 0 or i == drivesPerTeam:
            fieldPosition = 20
        if i % 2 == 0:
            drive = simDrive(i, fieldPosition, teamAName, teamARating, teamBName, teamBRating, gameID)

            if gameID:
                Drives.objects.create(
                    gameID = gameID,
                    driveID = i,
                    offense = teamAName,
                    defense = teamBName,
                    startingFP = fieldPosition,
                    result = drive['result'],
                    yards = drive['yards'],
                    playCount = drive['playCount'],
                    points = drive['points']
                )

            game['drives'].append(drive)
            fieldPosition = drive['nextDriveFP']
        else:
            drive = simDrive(i, fieldPosition, teamBName, teamBRating, teamAName, teamARating, gameID)

            if gameID:
                Drives.objects.create(
                    gameID = gameID,
                    driveID = i,
                    offense = teamBName,
                    defense = teamAName,
                    startingFP = fieldPosition,
                    result = drive['result'],
                    yards = drive['yards'],
                    playCount = drive['playCount'],
                    points = drive['points']
                )

            game['drives'].append(drive)
            fieldPosition = drive['nextDriveFP']

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
        game = overtime(drivesPerTeam, game, teamAName, teamARating, teamBName, teamBRating, gameID)
    
    if game['scoreA'] > game['scoreB']:
        game['winner'] = teamAName
    else:
        game['winner'] = teamBName

    return game

def overtime(drivesPerTeam, game, teamAName, teamARating, teamBName, teamBRating, gameID=None):
    i = drivesPerTeam * 2
    while game['scoreA'] == game['scoreB']:
        game['overtime'] += 1
        drive = simDrive(i, 50, teamAName, teamARating, teamBName, teamBRating, gameID)
        if gameID:
            Drives.objects.create(
                gameID = gameID,
                driveID = i,
                offense = teamAName,
                defense = teamBName,
                startingFP = 50,
                result = drive['result'],
                yards = drive['yards'],
                playCount = drive['playCount'],
                points = drive['points']
            )
        game['scoreA'] += drive['points']
        game['drives'].append(drive)
        i += 1

        drive = simDrive(i, 50, teamBName, teamBRating, teamAName, teamARating, gameID)
        if gameID:
            Drives.objects.create(
                gameID = gameID,
                driveID = i,
                offense = teamBName,
                defense = teamAName,
                startingFP = 50,
                result = drive['result'],
                yards = drive['yards'],
                playCount = drive['playCount'],
                points = drive['points']
            )
        game['scoreB'] += drive['points']
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