import random
from api.models import *
from ..constants.sim_constants import *


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
    """
    Simulate a pass play with outcome and yardage.

    Args:
        fieldPosition: Current field position (yards from own goal line)
        offense: Team on offense
        defense: Team on defense

    Returns:
        dict: Outcome and yards gained from the pass play
    """
    # Generate all random values at once
    rand_sack = random.random()
    rand_completion = random.random()
    rand_interception = random.random()

    result = {"outcome": None, "yards": 0}

    # Determine play outcome based on probabilities
    if rand_sack < BASE_SACK_RATE:
        # Sack
        result["outcome"] = "sack"
        result["yards"] = sackYards()
    elif rand_completion < BASE_COMP_PERCENT:
        # Completed pass
        result["yards"] = passYards(offense, defense)

        # Check for touchdown
        if result["yards"] + fieldPosition >= 100:
            result["yards"] = 100 - fieldPosition
            result["outcome"] = "touchdown"
        else:
            result["outcome"] = "pass"
    elif rand_interception < BASE_INT_RATE:
        # Interception
        result["outcome"] = "interception"
    else:
        # Incomplete pass
        result["outcome"] = "incomplete pass"

    return result


def simRun(fieldPosition, offense, defense):
    """
    Simulate a run play with outcome and yardage.

    Args:
        fieldPosition: Current field position (yards from own goal line)
        offense: Team on offense
        defense: Team on defense

    Returns:
        dict: Outcome and yards gained from the run play
    """
    # Generate fumble check at once
    rand_fumble = random.random()

    result = {"outcome": None, "yards": 0}

    if rand_fumble < BASE_FUMBLE_RATE:
        # Fumble
        result["outcome"] = "fumble"
    else:
        # Successful run
        result["yards"] = runYards(offense, defense)

        # Check for touchdown
        if result["yards"] + fieldPosition >= 100:
            result["yards"] = 100 - fieldPosition
            result["outcome"] = "touchdown"
        else:
            result["outcome"] = "run"

    return result


def passYards(offense, defense):
    rating_difference = offense.offense - defense.defense
    advantage_yardage = rating_difference * PASS_ADVANTAGE_FACTOR
    mean_yardage = PASS_BASE_MEAN + advantage_yardage
    raw_yardage = random.gauss(
        mean_yardage, PASS_STD_DEV
    )  # simulating normal distribution

    if raw_yardage < 0:
        return round(raw_yardage)
    else:
        multiplied_yards = raw_yardage + (
            PASS_POSITIVE_MULTIPLIER * (raw_yardage**PASS_POSITIVE_POWER)
        )
        rounded_yards = round(multiplied_yards)
        return min(rounded_yards, 99)


def sackYards():
    raw_yardage = random.gauss(SACK_BASE_MEAN, SACK_STD_DEV)
    rounded_yards = round(raw_yardage)
    return min(rounded_yards, 0)


def runYards(offense, defense):
    rating_difference = offense.offense - defense.defense
    advantage_yardage = rating_difference * RUN_ADVANTAGE_FACTOR
    mean_yardage = RUN_BASE_MEAN + advantage_yardage
    raw_yardage = random.gauss(mean_yardage, RUN_STD_DEV)

    if raw_yardage < 0:
        return round(raw_yardage)
    else:
        multiplied_yards = raw_yardage + (
            RUN_POSITIVE_MULTIPLIER * (raw_yardage**RUN_POSITIVE_POWER)
        )
        rounded_yards = round(multiplied_yards)
        return min(rounded_yards, 99)


def simDrive(
    game, fieldPosition, lead, offense, defense, driveNum, info, plays_to_create
):
    """
    Simulate a single drive in a football game.

    Args:
        game: The game object
        fieldPosition: Starting field position (yards from own goal line)
        lead: Current score lead/deficit for the offensive team
        offense: Team on offense
        defense: Team on defense
        driveNum: Drive number in the game
        info: Optional info object for database operations
        plays_to_create: List to collect play objects for bulk creation

    Returns:
        tuple: (drive object, new field position for next drive)
    """
    # Calculate drive number and points needed
    drive_index = driveNum // 2 if driveNum % 2 == 0 else (driveNum - 1) // 2
    needed = points_needed(lead, drive_index)

    # Create drive object
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

    # Simulate plays until drive ends
    while not drive.result:
        for down in range(1, 5):
            # Create play object
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
                play = Play(game, drive, offense, defense, fieldPosition, down)

            # Set yards needed for first down
            if down == 1:
                yardsLeft = 100 - fieldPosition if fieldPosition >= 90 else 10
            play.yardsLeft = yardsLeft

            # Handle 4th down decisions
            if down == 4:
                decision = fourthDown(fieldPosition, yardsLeft, needed)

                # Field goal attempt
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
                        return drive, 100 - fieldPosition

                # Punt
                elif decision == "punt":
                    play.playType = "punt"
                    play.yardsGained = 0
                    play.result = "punt"
                    if info:
                        plays_to_create.append(play)

                    drive.result = "punt"
                    return drive, 100 - (fieldPosition + 40)

            # Simulate offensive play (pass or run)
            is_pass_play = random.random() < BASE_PASS_FREQ

            if is_pass_play:
                # Pass play
                result = simPass(fieldPosition, offense, defense)
                play.playType = "pass"

                # Handle interception
                if result["outcome"] == "interception":
                    play.yardsGained = 0
                    play.result = "interception"
                    if info:
                        plays_to_create.append(play)

                    drive.result = "interception"
                    return drive, 100 - fieldPosition
            else:
                # Run play
                result = simRun(fieldPosition, offense, defense)
                play.playType = "run"

                # Handle fumble
                if result["outcome"] == "fumble":
                    play.yardsGained = 0
                    play.result = "fumble"
                    if info:
                        plays_to_create.append(play)

                    drive.result = "fumble"
                    return drive, 100 - fieldPosition

            # Update play and field position
            yardsGained = result["yards"]
            play.yardsGained = yardsGained
            play.result = result["outcome"]

            # Update field position and yards left
            fieldPosition += yardsGained
            yardsLeft -= yardsGained

            # Add play to database
            if info:
                plays_to_create.append(play)

            # Handle play outcomes
            if result["outcome"] == "touchdown":
                drive.result = "touchdown"
                drive.points = 7
                update_score_after(game, drive)
                return drive, 20
            elif fieldPosition < 1:
                drive.result = "safety"
                drive.points = 0
                update_score_after(game, drive)
                return drive, 20
            elif down == 4 and yardsLeft > 0:
                drive.result = "turnover on downs"
                return drive, 100 - fieldPosition

            # Check if first down achieved
            if yardsLeft <= 0:
                break  # Reset downs


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
    """
    Simulate a complete football game including regular time and overtime if needed.

    Args:
        game: The game object to simulate
        info: Optional info object for database operations
        drives_to_create: List to collect drive objects for bulk creation
        plays_to_create: List to collect play objects for bulk creation
    """
    # Reset game score
    game.scoreA = game.scoreB = 0
    total_drives = DRIVES_PER_TEAM * 2

    # Simulate regular time drives
    for i in range(total_drives):
        # Determine offense and defense for this drive
        is_team_a_offense = i % 2 == 0
        offense = game.teamA if is_team_a_offense else game.teamB
        defense = game.teamB if is_team_a_offense else game.teamA
        lead = (
            game.scoreA - game.scoreB
            if is_team_a_offense
            else game.scoreB - game.scoreA
        )

        # Set starting field position for first drive of each half
        if i == 0 or i == DRIVES_PER_TEAM:
            fieldPosition = 20

        # Simulate the drive
        drive, fieldPosition = simDrive(
            game, fieldPosition, lead, offense, defense, i, info, plays_to_create
        )

        # Update game score
        game.scoreA = drive.scoreAAfter
        game.scoreB = drive.scoreBAfter

        # Store drive for database creation
        if info and drives_to_create is not None:
            drives_to_create.append(drive)

    # Simulate overtime if needed
    if game.scoreA == game.scoreB:
        overtime(game, info, drives_to_create, plays_to_create)

    # Set the winner without updating team records
    if game.scoreA > game.scoreB:
        game.winner = game.teamA
        game.resultA, game.resultB = "W", "L"
    else:
        game.winner = game.teamB
        game.resultA, game.resultB = "L", "W"


def overtime(game, info=None, drives_to_create=None, plays_to_create=None):
    """
    Simulate overtime periods until a winner is determined.

    Args:
        game: The game object to simulate overtime for
        info: Optional info object for database operations
        drives_to_create: List to collect drive objects for bulk creation
        plays_to_create: List to collect play objects for bulk creation
    """
    # Start drive counter after regular time
    drive_num = (DRIVES_PER_TEAM * 2) + 1

    while game.scoreA == game.scoreB:
        game.overtime += 1

        # Simulate both teams' possessions in this overtime period
        for possession in range(2):
            # Alternate possession between teams
            is_team_a_offense = possession == 0
            offense = game.teamA if is_team_a_offense else game.teamB
            defense = game.teamB if is_team_a_offense else game.teamA
            lead = (
                game.scoreA - game.scoreB
                if is_team_a_offense
                else game.scoreB - game.scoreA
            )

            # Simulate drive
            drive, _ = simDrive(
                game,
                OT_START_YARD_LINE,
                lead,
                offense,
                defense,
                drive_num,
                info,
                plays_to_create,
            )

            # Update game score
            game.scoreA = drive.scoreAAfter
            game.scoreB = drive.scoreBAfter

            # Store drive for database creation
            if info and drives_to_create is not None:
                drives_to_create.append(drive)

            # Increment drive counter
            drive_num += 1

            # If team A scores and team B doesn't match in their possession, end overtime
            if possession == 1 and game.scoreA != game.scoreB:
                break


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
