import random
from api.models import *
from ..constants.sim_constants import *


def _adjusted_ratings(offense, defense, game=None):
    offense_rating = offense.offense
    defense_rating = defense.defense
    if game and not game.neutralSite:
        if game.homeTeam == offense:
            offense_rating += HOME_FIELD_ADVANTAGE
        elif game.homeTeam == defense:
            defense_rating += HOME_FIELD_ADVANTAGE
    return offense_rating, defense_rating


def simPass(fieldPosition, offense, defense, game=None):
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
        result["yards"] = passYards(offense, defense, game)

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


def simRun(fieldPosition, offense, defense, game=None):
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
        result["yards"] = runYards(offense, defense, game)

        # Check for touchdown
        if result["yards"] + fieldPosition >= 100:
            result["yards"] = 100 - fieldPosition
            result["outcome"] = "touchdown"
        else:
            result["outcome"] = "run"

    return result


def passYards(offense, defense, game=None):
    offense_rating, defense_rating = _adjusted_ratings(offense, defense, game)
    rating_difference = offense_rating - defense_rating
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


def runYards(offense, defense, game=None):
    offense_rating, defense_rating = _adjusted_ratings(offense, defense, game)
    rating_difference = offense_rating - defense_rating
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


def format_play_text(play, starters):
    rb_starters = starters.get((play.offense, "rb"), [])
    qb_starters = starters.get((play.offense, "qb"), [])
    wr_starters = starters.get((play.offense, "wr"), [])
    te_starters = starters.get((play.offense, "te"), [])
    k_starters = starters.get((play.offense, "k"), [])
    p_starters = starters.get((play.offense, "p"), [])

    if play.playType == "run":
        runner = random.choice(rb_starters)
        if play.result == "fumble":
            play.text = f"{runner.first} {runner.last} fumbled"
        elif play.result == "touchdown":
            play.text = f"{runner.first} {runner.last} ran {play.yardsGained} yards for a touchdown"
        else:
            play.text = f"{runner.first} {runner.last} ran for {play.yardsGained} yards"

    elif play.playType == "pass":
        qb = qb_starters[0]

        if play.result == "sack":
            play.text = f"{qb.first} {qb.last} was sacked for a loss of {abs(play.yardsGained)} yards"
        elif play.result == "interception":
            play.text = f"{qb.first} {qb.last}'s pass was intercepted"
        elif play.result == "incomplete pass":
            play.text = f"{qb.first} {qb.last}'s pass was incomplete"
        else:
            # Complete pass or touchdown - need receiver
            candidates = wr_starters + te_starters + rb_starters
            receiver = choose_receiver(candidates)

            if play.result == "touchdown":
                play.text = f"{qb.first} {qb.last} pass complete to {receiver.first} {receiver.last} for {play.yardsGained} yards for a touchdown"
            else:
                play.text = f"{qb.first} {qb.last} pass complete to {receiver.first} {receiver.last} for {play.yardsGained} yards"

    elif play.playType == "field goal":
        kicker = k_starters[0]
        kicker_name = f"{kicker.first} {kicker.last}"
        distance = 100 - play.startingFP + 17

        if play.result == "made field goal":
            play.text = (
                f"{kicker_name}'s {distance} yard field goal is good"
            )
        else:
            play.text = (
                f"{kicker_name}'s {distance} yard field goal is no good"
            )

    elif play.playType == "punt":
        punter = p_starters[0] if p_starters else None
        play.text = f"{punter.first} {punter.last} punted" if punter else "Punt"


def simDrive(
    game,
    fieldPosition,
    lead,
    offense,
    defense,
    driveNum,
    info,
    plays_to_create=None,
    starters=None,
):
    use_play_objects = plays_to_create is not None
    # Calculate drive number and points needed
    drive_index = driveNum // 2 if driveNum % 2 == 0 else (driveNum - 1) // 2
    needed = points_needed(lead, drive_index)

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

    # Simulate plays until drive ends
    while not drive.result:
        for down in range(1, 5):
            play = None
            if use_play_objects:
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

            # Set yards needed for first down
            if down == 1:
                yardsLeft = 100 - fieldPosition if fieldPosition >= 90 else 10

            if play is not None:
                play.yardsLeft = yardsLeft

            # Set play header only for database Play objects (not in-memory Play class)
            if play is not None and info:
                set_play_header(play)

            # Handle 4th down decisions
            if down == 4:
                decision = decide_fourth_down(fieldPosition, yardsLeft, needed)

                if decision == "field_goal":
                    if play is not None:
                        play.playType = "field goal"
                        play.yardsGained = 0

                    if fieldGoal(fieldPosition):
                        play_result = "made field goal"
                        drive.result = "made field goal"
                        drive.points = 3
                        update_drive_score_after(game, drive)
                    else:
                        play_result = "missed field goal"
                        drive.result = "missed field goal"
                        drive.points = 0

                    if play is not None:
                        play.result = play_result
                    # Format play text if starters are available
                    if play is not None and starters and info:
                        format_play_text(play, starters)

                    if play is not None:
                        plays_to_create.append(play)
                    return (
                        drive,
                        20
                        if play_result == "made field goal"
                        else 100 - fieldPosition,
                    )

                elif decision == "punt":
                    if play is not None:
                        play.playType = "punt"
                        play.result = "punt"
                        play.yardsGained = 0
                    drive.result = "punt"
                    drive.points = 0

                    # Format play text if starters are available
                    if play is not None and starters and info:
                        format_play_text(play, starters)

                    if play is not None:
                        plays_to_create.append(play)
                    return drive, 100 - (fieldPosition + 40)

            if random.random() < 0.5:
                play_type = "run"
                result = simRun(fieldPosition, offense, defense, game)
            else:
                play_type = "pass"
                result = simPass(fieldPosition, offense, defense, game)

            if play is not None:
                play.playType = play_type
                play.yardsGained = result["yards"]
                play.result = result["outcome"]
            fieldPosition += result["yards"]
            yardsLeft -= result["yards"]
            if play is not None:
                play.yardsLeft = yardsLeft

            # Format play text if starters are available
            if play is not None and starters and info:
                format_play_text(play, starters)

            if play is not None:
                plays_to_create.append(play)

            # Update play and field position
            if result["outcome"] == "touchdown":
                drive.result = "touchdown"
                drive.points = 7
                update_drive_score_after(game, drive)
                return drive, 20
            elif result["outcome"] == "interception":
                drive.result = "interception"
                return drive, 100 - fieldPosition
            elif result["outcome"] == "fumble":
                drive.result = "fumble"
                return drive, 100 - fieldPosition
            elif fieldPosition < 1:
                drive.result = "safety"
                drive.points = 0
                update_drive_score_after(game, drive)
                return drive, 20
            elif down == 4 and yardsLeft > 0:
                drive.result = "turnover on downs"
                return drive, 100 - fieldPosition

            # Check for first down - if yardsLeft <= 0, reset to 1st down
            if yardsLeft <= 0:
                # First down achieved, reset to 1st down and recalculate yardsLeft
                down = 0  # Will become 1 in next iteration
                yardsLeft = 100 - fieldPosition if fieldPosition >= 90 else 10
                break  # Exit the down loop to start fresh with 1st down


def decide_fourth_down(fieldPosition, yardsLeft, needed):
    """
    Conservative fourth-down logic with a single source of truth.
    fieldPosition is yards from own goal line. FG distance = (100 - fieldPosition) + 17.
    """
    # Base decision by field position and distance to go.
    if fieldPosition <= 40:
        decision = "punt"
    elif fieldPosition <= 50:
        decision = "go" if yardsLeft == 1 else "punt"
    elif fieldPosition <= 62:
        decision = "go" if yardsLeft <= 2 else "punt"
    else:
        decision = "go" if yardsLeft <= 3 else "field_goal"

    # If points are needed to stay in the game, avoid punts and low-value FGs.
    if needed > 0:
        if decision == "punt":
            decision = "go"
        elif decision == "field_goal" and needed > 3:
            decision = "go"

    return decision


def simGame(
    game, info=None, drives_to_create=None, plays_to_create=None, starters=None
):
    """
    Simulate a complete football game including regular time and overtime if needed.

    Args:
        game: The game object to simulate
        info: Optional info object for database operations (if None, fake game)
        drives_to_create: List to collect drive objects for bulk creation (if None, fake game)
        plays_to_create: List to collect play objects for bulk creation (if None, fake game)
    """
    # Reset game score
    game.scoreA = game.scoreB = 0
    total_drives = DRIVES_PER_TEAM * 2

    # Simulate regular time drives
    for i in range(total_drives):
        # Determine offense and defense for this drive
        if i % 2 == 0:
            offense = game.teamA
            defense = game.teamB
            lead = game.scoreA - game.scoreB
        else:
            offense = game.teamB
            defense = game.teamA
            lead = game.scoreB - game.scoreA

        # Set starting field position for first drive of each half
        if i == 0 or i == DRIVES_PER_TEAM:
            fieldPosition = 20

        # Simulate the drive
        drive, fieldPosition = simDrive(
            game,
            fieldPosition,
            lead,
            offense,
            defense,
            i,
            info,
            plays_to_create,
            starters,
        )

        # Update game score
        game.scoreA = drive.scoreAAfter
        game.scoreB = drive.scoreBAfter

        # Store drive for database creation (only for real games)
        if info and drives_to_create is not None:
            drives_to_create.append(drive)

    # Simulate overtime if needed
    if game.scoreA == game.scoreB:
        overtime(game, info, drives_to_create, plays_to_create, starters)

    # Set the winner without updating team records
    if game.scoreA > game.scoreB:
        game.winner = game.teamA
        game.resultA, game.resultB = "W", "L"
    else:
        game.winner = game.teamB
        game.resultA, game.resultB = "L", "W"


def overtime(game, info=None, drives_to_create=None, plays_to_create=None, starters=None):
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
                starters,
            )

            # Update game score
            game.scoreA = drive.scoreAAfter
            game.scoreB = drive.scoreBAfter

            # Store drive for database creation (only for real games)
            if info and drives_to_create is not None:
                drives_to_create.append(drive)

            # Increment drive counter
            drive_num += 1

            # If team A scores and team B doesn't match in their possession, end overtime
            if possession == 1 and game.scoreA != game.scoreB:
                break


def fieldGoal(field_position):
    """
    Decide FG make/miss given line of scrimmage measured from the kicking team's own goal line.
    Example: field_position=60 (opponent 40) -> distance = (100 - 60) + 17 = 57 yards.
    """
    yard_line = 100 - field_position
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


def update_drive_score_after(game, drive):
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


def set_play_header(play):
    """Set play header during simulation"""
    if play.startingFP < 50:
        location = f"{play.offense.abbreviation} {play.startingFP}"
    elif play.startingFP > 50:
        location = f"{play.defense.abbreviation} {100 - play.startingFP}"
    else:
        location = f"{play.startingFP}"

    if play.startingFP + play.yardsLeft >= 100:
        if play.down == 1:
            play.header = f"{play.down}st and goal at {location}"
        elif play.down == 2:
            play.header = f"{play.down}nd and goal at {location}"
        elif play.down == 3:
            play.header = f"{play.down}rd and goal at {location}"
        elif play.down == 4:
            play.header = f"{play.down}th and goal at {location}"
    else:
        if play.down == 1:
            play.header = f"{play.down}st and {play.yardsLeft} at {location}"
        elif play.down == 2:
            play.header = f"{play.down}nd and {play.yardsLeft} at {location}"
        elif play.down == 3:
            play.header = f"{play.down}rd and {play.yardsLeft} at {location}"
        elif play.down == 4:
            play.header = f"{play.down}th and {play.yardsLeft} at {location}"


def choose_receiver(candidates, rating_exponent=4):
    """Choose a receiver with improved performance."""
    if not candidates:
        return None

    # Use pre-computed position bias values
    pos_bias = {"wr": 1.4, "te": 1.0, "rb": 0.6}

    # Calculate weighted chances directly
    chances = []
    total_chance = 0

    for candidate in candidates:
        # Use faster power calculation
        weighted_rating = candidate.rating**rating_exponent
        chance = weighted_rating * pos_bias.get(candidate.pos.lower(), 1.0)
        chances.append(chance)
        total_chance += chance

    # Avoid division by zero
    if total_chance == 0:
        return random.choice(candidates)

    # Normalize chances
    normalized_chances = [chance / total_chance for chance in chances]

    # Use random.choices for weighted selection
    return random.choices(candidates, weights=normalized_chances, k=1)[0]
