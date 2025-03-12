import random

try:
    from start.models import *
except ModuleNotFoundError:
    pass

WIN_FACTOR = 1.5
LOSS_FACTOR = 1.08
DRIVES_PER_TEAM = 12
BASE_PASS_FREQ = 0.5
OT_START_YARD_LINE = 75
BASE_COMP_PERCENT = 0.62
BASE_SACK_RATE = 0.07
BASE_INT_RATE = 0.07
BASE_FUMBLE_RATE = 0.02
FIELD_GOAL_RANGE = 60


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
    def __init__(self, game, offense, defense, fieldPosition, i, needed):
        self.game = game
        self.offense = offense
        self.defense = defense
        self.startingFP = fieldPosition
        self.driveNum = i
        self.result = None
        self.points = 0
        self.points_needed = needed
        self.scoreAAfter = game.scoreA
        self.scoreBAfter = game.scoreB


class Play:
    def __init__(self, game, drive, offense, defense, fieldPosition, down):
        game = game
        drive = drive
        offense = offense
        defense = defense
        startingFP = fieldPosition
        down = down


def simPass(fieldPosition, offense, defense):
    result = {
        "outcome": None,
        "yards": None,
    }

    if random.random() < BASE_SACK_RATE:  # sack
        result["outcome"] = "sack"
        result["yards"] = sackYards(offense, defense)
    elif random.random() < BASE_COMP_PERCENT:  # completed pass
        result["yards"] = passYards(offense, defense)

        if result["yards"] + fieldPosition >= 100:
            result["yards"] = 100 - fieldPosition
            result["outcome"] = "touchdown"
        else:
            result["outcome"] = "pass"

    elif random.random() < BASE_INT_RATE:  # interception
        result["outcome"] = "interception"
        result["yards"] = 0

    else:  # incomplete pass
        result["outcome"] = "incomplete pass"
        result["yards"] = 0

    return result


def simRun(fieldPosition, offense, defense):
    result = {"outcome": None, "yards": None}

    if random.random() < BASE_FUMBLE_RATE:  # fumble
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
    lead,
    offense,
    defense,
    driveNum,
    info,
    plays_to_create,
):
    if driveNum % 2 == 0:
        num = int((driveNum / 2))
    else:
        num = int((driveNum - 1) / 2)

    needed = points_needed(lead, num)

    # if driveNum % 2 == 0:
    #     num = int((driveNum / 2))
    #     lead = game.scoreA - game.scoreB
    #     print(
    #         f"Team lead/deficit: {lead}   Drives left: {DRIVES_PER_TEAM - num}   Points needed this drive: {needed}"
    #     )
    # else:
    #     num = int((driveNum - 1) / 2)
    #     lead = game.scoreB - game.scoreA
    #     print(
    #         f"Team lead/deficit: {lead}   Drives left: {DRIVES_PER_TEAM - num}   Points needed this drive: {needed}"
    #     )

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
            points_needed=needed,
            scoreAAfter=game.scoreA,
            scoreBAfter=game.scoreB,
        )
    else:
        drive = Drive(game, offense, defense, fieldPosition, driveNum, needed)

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
                    scoreA=game.scoreA,
                    scoreB=game.scoreB,
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
                decision = fourthDown(fieldPosition, yardsLeft, needed)

                if decision == "field goal":
                    play.playType = "field goal"
                    play.yardsGained = 0

                    if fieldGoal(100 - fieldPosition):
                        play.result = "made field goal"
                        if info:
                            plays_to_create.append(play)

                        drive.result = "field goal"
                        drive.points = 3
                        update_score_after(game, drive)

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

            if random.random() < BASE_PASS_FREQ:
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
                update_score_after(game, drive)

                return drive, 20
            elif down == 4 and yardsLeft > 0:
                drive.result = "turnover on downs"
                drive.points = 0

                return drive, 100 - fieldPosition
            elif fieldPosition < 1:
                drive.result = "safety"
                drive.points = 0
                update_score_after(game, drive)

                return drive, 20

            if yardsLeft <= 0:  # new set of downs if first down has been made
                break


def fourthDown(fieldPosition, yardsLeft, needed):
    # Always go for it if needed points are more than 3
    if needed in [6, 7, 8]:
        return "go"

    # Decisions when needed points are 3
    if needed == 3:
        if fieldPosition < FIELD_GOAL_RANGE:
            # If not in field goal range, go for it
            return "go"
        else:
            # In field goal range, attempt a field goal
            return "field goal"

    # Standard decisions based on field position and yards left
    if fieldPosition < 40:
        return "punt"
    elif fieldPosition < FIELD_GOAL_RANGE:
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
    game.scoreA = game.scoreB = 0

    for i in range(DRIVES_PER_TEAM * 2):
        if i % 2 == 0:
            offense = game.teamA
            defense = game.teamB
            lead = game.scoreA - game.scoreB
        else:
            offense = game.teamB
            defense = game.teamA
            lead = game.scoreB - game.scoreA
        if i == 0 or i == DRIVES_PER_TEAM:
            fieldPosition = 20

        drive, fieldPosition = simDrive(
            game,
            fieldPosition,
            lead,
            offense,
            defense,
            i,
            info,
            plays_to_create,
        )

        game.scoreA = drive.scoreAAfter
        game.scoreB = drive.scoreBAfter

        if info:
            drives_to_create.append(drive)

    if game.scoreA == game.scoreB:
        overtime(game, info, drives_to_create, plays_to_create)

    if game.scoreA > game.scoreB:
        game.winner = game.teamA

        if info:
            if game.teamA.conference and (
                game.teamA.conference == game.teamB.conference
            ):
                game.teamA.confWins += 1
                game.teamB.confLosses += 1
            else:
                game.teamA.nonConfWins += 1
                game.teamB.nonConfLosses += 1
            game.resultA = "W"
            game.resultB = "L"
            game.teamA.totalWins += 1
            game.teamB.totalLosses += 1
            game.teamA.resume_total += game.teamB.rating**WIN_FACTOR
            game.teamB.resume_total += game.teamA.rating**LOSS_FACTOR
    elif game.scoreA < game.scoreB:
        game.winner = game.teamB

        if info:
            if game.teamA.conference and (
                game.teamA.conference == game.teamB.conference
            ):
                game.teamA.confLosses += 1
                game.teamB.confWins += 1
            else:
                game.teamA.nonConfLosses += 1
                game.teamB.nonConfWins += 1
            game.resultA = "L"
            game.resultB = "W"
            game.teamA.totalLosses += 1
            game.teamB.totalWins += 1
            game.teamB.resume_total += game.teamA.rating**WIN_FACTOR
            game.teamA.resume_total += game.teamB.rating**LOSS_FACTOR

    if info:
        game.teamA.gamesPlayed += 1
        game.teamB.gamesPlayed += 1
        game.teamA.save()
        game.teamB.save()


def overtime(game, info=None, drives_to_create=None, plays_to_create=None):
    i = (DRIVES_PER_TEAM * 2) + 1

    while game.scoreA == game.scoreB:
        game.overtime += 1

        offense = game.teamA
        defense = game.teamB
        lead = game.scoreA - game.scoreB
        i += 1

        drive, fieldPosition = simDrive(
            game,
            OT_START_YARD_LINE,
            lead,
            offense,
            defense,
            i,
            info,
            plays_to_create,
        )

        game.scoreA = drive.scoreAAfter
        game.scoreB = drive.scoreBAfter

        if info:
            drives_to_create.append(drive)

        offense = game.teamB
        defense = game.teamA
        lead = game.scoreB - game.scoreA
        i += 1

        drive, fieldPosition = simDrive(
            game,
            OT_START_YARD_LINE,
            lead,
            offense,
            defense,
            i,
            info,
            plays_to_create,
        )

        game.scoreA = drive.scoreAAfter
        game.scoreB = drive.scoreBAfter

        if info:
            drives_to_create.append(drive)


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


def points_needed(lead, driveNum):
    if lead >= 0:
        # No points needed if the team is leading or the game is tied
        return 0

    drivesLeft = max(1, (DRIVES_PER_TEAM - driveNum))
    deficit = abs(lead)

    possible_scores = [3, 6, 7, 8]
    max_score_in_one_drive = max(possible_scores)

    # If the team can tie or win the game without scoring on the current drive
    if deficit <= (drivesLeft - 1) * max_score_in_one_drive:
        return 0

    # Adjust the logic for when only one drive is left
    if drivesLeft == 1:
        # If only one drive is left, return the minimum score that would surpass the deficit
        for points in possible_scores:
            if points >= deficit:
                return points

    # For more than one drive left, find the minimum points needed on this drive
    for points in possible_scores:
        if deficit - points <= (drivesLeft - 1) * max_score_in_one_drive:
            return points

    # If it's impossible to tie or win with the scores in 'possible_scores'
    return 9  # Indicates the game is out of reach


def update_score_after(game, drive):
    if not drive.result == "safety":
        if drive.offense == game.teamA:
            drive.scoreAAfter += drive.points
        else:
            drive.scoreBAfter += drive.points
    else:
        if drive.offense == game.teamA:
            drive.scoreBAfter += 2
        else:
            drive.scoreAAfter += 2
