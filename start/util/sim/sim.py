import random

try:
    from start.models import *
except ModuleNotFoundError:
    pass


class Team:
    def __init__(self, rating):
        self.rating = rating
        self.offense = rating
        self.defense = rating


class Game:
    def __init__(self, teamA, teamB):
        self.teamA = teamA
        self.teamB = teamB
        self.scoreA = 0
        self.scoreB = 0
        self.overtime = 0
        self.winner = None


class Drive:
    def __init__(self, game, offense, defense, fieldPosition):
        self.game = game
        self.offense = offense
        self.defense = defense
        self.startingFP = fieldPosition
        self.result = None
        self.points = 0


class Play:
    def __init__(self, game, drive, offense, defense, fieldPosition, down):
        game = game
        drive = drive
        offense = offense
        defense = defense
        startingFP = fieldPosition
        down = down


def simPass(fieldPosition, offense, defense):
    comp = 0.62
    sack = 0.07
    int = 0.07

    result = {
        "outcome": None,
        "yards": None,
    }

    if random.random() < sack:  # sack
        result["outcome"] = "sack"
        result["yards"] = sackYards(offense, defense)
    elif random.random() < comp:  # completed pass
        result["yards"] = passYards(offense, defense)

        if result["yards"] + fieldPosition >= 100:
            result["yards"] = 100 - fieldPosition
            result["outcome"] = "touchdown"
        else:
            result["outcome"] = "pass"

    elif random.random() < int:  # interception
        result["outcome"] = "interception"
        result["yards"] = 0

    else:  # incomplete pass
        result["outcome"] = "incomplete pass"
        result["yards"] = 0

    return result


def simRun(fieldPosition, offense, defense):
    fumble_chance = 0.02

    result = {"outcome": None, "yards": None}

    if random.random() < fumble_chance:  # fumble
        result["outcome"] = "fumble"
        result["yards"] = 0
    else:
        result["yards"] = runYards(offense, defense)

        if result["yards"] + fieldPosition >= 100:
            result["yards"] = 100 - fieldPosition
            result["outcome"] = "touchdown"
        else:
            result["outcome"] = "run"

    return result


def passYards(offense, defense, base_mean=7.5, std_dev=7, advantage_factor=0.22):
    rating_difference = offense.offense - defense.defense
    advantage_yardage = rating_difference * advantage_factor
    mean_yardage = base_mean + advantage_yardage
    raw_yardage = random.gauss(mean_yardage, std_dev)  # simulating normal distribution

    if raw_yardage < 0:
        return round(raw_yardage / 3)
    else:
        return round(raw_yardage + (0.008 * (raw_yardage**2.7)))


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
        return round(raw_yardage + (0.00044 * (raw_yardage**4.2)))


def simDrive(
    game,
    fieldPosition,
    offense,
    defense,
    info=None,
    driveNum=None,
    plays_to_create=None,
):
    passFreq = 0.5

    if info:
        drive = Drives(
            info=info,
            game=game,
            driveNum=driveNum,
            offense=offense,
            defense=defense,
            startingFP=fieldPosition,
            result=None,
            points=0,
        )
    else:
        drive = Drive(game, offense, defense, fieldPosition)

    while not drive.result:
        for down in range(1, 5):
            if info:
                play = Plays(
                    info=info,
                    game=game,
                    drive=drive,
                    offense=offense,
                    defense=defense,
                    startingFP=fieldPosition,
                    down=down,
                )
            else:
                play = Play(
                    game,
                    drive,
                    offense,
                    defense,
                    fieldPosition,
                    down,
                )

            if down == 1:
                if fieldPosition >= 90:  # check if first and goal
                    yardsLeft = 100 - fieldPosition
                else:
                    yardsLeft = 10

            play.yardsLeft = yardsLeft

            if down == 4:  # 4th down logic
                decision = fourthDown(fieldPosition, yardsLeft)

                if decision == "field goal":
                    play.playType = "field goal"
                    play.yardsGained = 0

                    if fieldGoal(100 - fieldPosition):
                        play.result = "made field goal"
                        if info:
                            plays_to_create.append(play)

                        drive.result = "field goal"
                        drive.points = 3

                        return drive, 20
                    else:
                        play.result = "missed field goal"
                        if info:
                            plays_to_create.append(play)

                        drive.result = "missed field goal"
                        drive.points = 0

                        return drive, 100 - fieldPosition

                elif decision == "punt":
                    play.playType = "punt"
                    play.yardsGained = 0
                    play.result = "punt"
                    if info:
                        plays_to_create.append(play)

                    drive.result = "punt"
                    drive.points = 0

                    return drive, 100 - (fieldPosition + 40)

            if random.random() < passFreq:
                result = simPass(fieldPosition, offense, defense)
                play.playType = "pass"

                if result["outcome"] == "interception":
                    play.yardsGained = 0
                    play.result = "interception"
                    if info:
                        plays_to_create.append(play)

                    drive.result = "interception"
                    drive.points = 0

                    return drive, 100 - fieldPosition

            else:
                result = simRun(fieldPosition, offense, defense)
                play.playType = "run"

                if result["outcome"] == "fumble":
                    play.yardsGained = 0
                    play.result = "fumble"
                    if info:
                        plays_to_create.append(play)

                    drive.result = "fumble"
                    drive.points = 0

                    return drive, 100 - fieldPosition

            yardsGained = result["yards"]
            yardsLeft -= yardsGained
            fieldPosition += yardsGained
            play.yardsGained = yardsGained
            play.result = result["outcome"]
            if info:
                plays_to_create.append(play)

            if result["outcome"] == "touchdown":  # adjust if touchdown
                drive.result = "touchdown"
                drive.points = 7

                return drive, 20
            elif down == 4 and yardsLeft > 0:
                drive.result = "turnover on downs"
                drive.points = 0

                return drive, 100 - fieldPosition
            elif fieldPosition < 1:
                drive.result = "safety"
                drive.points = 0

                return drive, 20

            if yardsLeft <= 0:  # new set of downs if first down has been made
                break


def fourthDown(fieldPosition, yardsLeft):
    if fieldPosition < 40:
        return "punt"
    elif fieldPosition < 60:
        if yardsLeft < 5:
            return "go"
        else:
            return "punt"
    elif fieldPosition < 70:
        if yardsLeft < 3:
            return "go"
        else:
            return "field goal"
    else:
        if yardsLeft < 5:
            return "go"
        else:
            return "field goal"


def simGame(game, info=None, drives_to_create=None, plays_to_create=None):
    winFactor = 1.5
    lossFactor = 1.15
    drivesPerTeam = 11
    fieldPosition = None
    game.scoreA = 0
    game.scoreB = 0

    for i in range(drivesPerTeam * 2):
        if i == 0 or i == drivesPerTeam:
            fieldPosition = 20
        if i % 2 == 0:
            if info:
                drive, fieldPosition = simDrive(
                    game,
                    fieldPosition,
                    game.teamA,
                    game.teamB,
                    info,
                    i,
                    plays_to_create,
                )
            else:
                drive, fieldPosition = simDrive(
                    game, fieldPosition, game.teamA, game.teamB
                )

            if not drive.result == "safety":
                game.scoreA += drive.points
            else:
                game.scoreB += 2

        else:
            if info:
                drive, fieldPosition = simDrive(
                    game,
                    fieldPosition,
                    game.teamB,
                    game.teamA,
                    info,
                    i,
                    plays_to_create,
                )
            else:
                drive, fieldPosition = simDrive(
                    game, fieldPosition, game.teamB, game.teamA
                )

            if not drive.result == "safety":
                game.scoreB += drive.points
            else:
                game.scoreA += 2

        if info:
            drives_to_create.append(drive)

    if game.scoreA == game.scoreB:
        game = overtime(game, drivesPerTeam, info, drives_to_create, plays_to_create)

    if game.scoreA > game.scoreB:
        game.winner = game.teamA

        if info:
            if game.teamA.conference == game.teamB.conference:
                game.teamA.confWins += 1
                game.teamB.confLosses += 1
            else:
                game.teamA.nonConfWins += 1
                game.teamB.nonConfLosses += 1
            game.resultA = "W"
            game.resultB = "L"
            game.teamA.totalWins += 1
            game.teamB.totalLosses += 1
            game.teamA.resume_total += game.teamB.rating**winFactor
            game.teamB.resume_total += game.teamA.rating**lossFactor
    elif game.scoreA < game.scoreB:
        game.winner = game.teamB

        if info:
            if game.teamA.conference == game.teamB.conference:
                game.teamA.confLosses += 1
                game.teamB.confWins += 1
            else:
                game.teamA.nonConfLosses += 1
                game.teamB.nonConfWins += 1
            game.resultA = "L"
            game.resultB = "W"
            game.teamA.totalLosses += 1
            game.teamB.totalWins += 1
            game.teamB.resume_total += game.teamA.rating**winFactor
            game.teamA.resume_total += game.teamB.rating**lossFactor

    if info:
        Teams.objects.bulk_update(
            [game.teamA, game.teamB],
            [
                "totalWins",
                "totalLosses",
                "confWins",
                "confLosses",
                "nonConfWins",
                "nonConfLosses",
                "resume_total",
            ],
        )


def overtime(
    game, drivesPerTeam, info=None, drives_to_create=None, plays_to_create=None
):
    i = (drivesPerTeam * 2) + 1

    while game.scoreA == game.scoreB:
        game.overtime += 1

        i += 1
        if info:
            drive, fieldPosition = simDrive(
                game,
                50,
                game.teamA,
                game.teamB,
                info,
                i,
                plays_to_create,
            )
            drives_to_create.append(drive)
        else:
            drive, fieldPosition = simDrive(game, 50, game.teamA, game.teamB)
        if not drive.result == "safety":
            game.scoreA += drive.points
        else:
            game.scoreB += 2

        i += 1
        if info:
            drive, fieldPosition = simDrive(
                game,
                50,
                game.teamB,
                game.teamA,
                info,
                i,
                plays_to_create,
            )
            drives_to_create.append(drive)
        else:
            drive, fieldPosition = simDrive(game, 50, game.teamB, game.teamA)
        if not drive.result == "safety":
            game.scoreB += drive.points
        else:
            game.scoreA += 2

    return game


def fieldGoal(yard_line):
    distance = yard_line + 17

    if distance < 37:
        return True
    elif 37 <= distance < 47:
        success_rate = 0.90 - (distance - 37) * 0.05
        return success_rate > random.random()
    elif 47 <= distance < 57:
        success_rate = 0.75 - (distance - 47) * 0.05
        return success_rate > random.random()
    elif 57 <= distance:
        success_rate = 0.55 - (distance - 57) * 0.03
        return success_rate > random.random()
    else:
        return False
