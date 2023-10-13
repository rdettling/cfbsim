import random

try:
    from . import sim
except ImportError:
    import sim


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
    def __init__(self, game, driveNum, offense, defense, fieldPosition):
        self.game = game
        self.driveNum = driveNum
        self.offense = offense
        self.defense = defense
        self.startingFP = fieldPosition
        self.result = None
        self.points = 0


class Play:
    def __init__(self, game, drive, offense, defense, fieldPosition, down):
        game = (game,)
        drive = (drive,)
        offense = (offense,)
        defense = (defense,)
        startingFP = (fieldPosition,)
        down = down


def testRun(team1, team2, simulations=10000):
    print(f"Offense rating: {team1.offense} Defnse rating: {team2.defense}")

    results = [sim.runYards(team1, team2) for _ in range(simulations)]
    results.sort()

    # Compute the percentiles
    percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
    for p in percentiles:
        index = int(p / 100 * simulations) - 1  # Subtract 1 because lists are 0-based
        print(f"{p}th Percentile Yards Gained: {results[index]}")

    average_yards = sum(results) / simulations
    print(f"Average Yards Gained: {average_yards}")


def testPass(team1, team2, simulations=10000):
    print(f"Offense rating: {team1.offense} Defnse rating: {team2.defense}")

    results = [sim.passYards(team1, team2) for _ in range(simulations)]
    results.sort()

    # Compute the percentiles
    percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
    for p in percentiles:
        index = int(p / 100 * simulations) - 1  # Subtract 1 because lists are 0-based
        print(f"{p}th Percentile Yards Gained: {results[index]}")

    average_yards = sum(results) / simulations
    print(f"Average Yards Gained: {average_yards}")


def testSack(team1, team2, simulations=10000):
    print(f"Offense rating: {team1.offense} Defnse rating: {team2.defense}")

    results = [sim.sackYards(team1, team2) for _ in range(simulations)]
    results.sort()

    # Compute the percentiles
    percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
    for p in percentiles:
        index = int(p / 100 * simulations) - 1  # Subtract 1 because lists are 0-based
        print(f"{p}th Percentile Yards Gained: {results[index]}")

    average_yards = sum(results) / simulations
    print(f"Average Yards Gained: {average_yards}")


def testYards(team1, team2, simulations=10000):
    comp = 0.62  # completion percentage

    print(f"Offense rating: {team1.offense} Defnse rating: {team2.defense}")

    passYards_total = 0
    rushYards_total = sum([sim.runYards(team1, team2) for _ in range(simulations)])

    # simulate passYards
    for _ in range(simulations):
        if random.random() < comp:
            passYards_total += sim.passYards(team1, team2)
        # else it's an incomplete pass and we increment by 0, so do nothing

    average = (passYards_total + rushYards_total) / (2 * simulations)

    print(f"Average yards per play: {average}")
    print(f"Average yards per rush: {rushYards_total / simulations}")
    print(f"Average yards per pass: {passYards_total / simulations}")


def simGame(game):
    drivesPerTeam = 12
    fieldPosition = None
    game.scoreA = 0
    game.scoreB = 0

    for i in range(drivesPerTeam * 2):
        if i == 0 or i == drivesPerTeam:
            fieldPosition = 20
        if i % 2 == 0:
            drive, fieldPosition = simDrive(
                game, i, fieldPosition, game.teamA, game.teamB
            )

            if not drive.result == "safety":
                game.scoreA += drive.points
            else:
                game.scoreB += 2
        else:
            drive, fieldPosition = simDrive(
                game, i, fieldPosition, game.teamB, game.teamA
            )

            if not drive.result == "safety":
                game.scoreB += drive.points
            else:
                game.scoreA += 2

    if game.scoreA == game.scoreB:
        game = overtime(game, drivesPerTeam)

    if game.scoreA > game.scoreB:
        game.winner = game.teamA
    else:
        game.winner = game.teamB


def overtime(game, drivesPerTeam):
    i = (drivesPerTeam * 2) + 1

    while game.scoreA == game.scoreB:
        game.overtime += 1

        i += 1
        drive, fieldPosition = simDrive(game, i, 50, game.teamA, game.teamB)
        if not drive.result == "safety":
            game.scoreA += drive.points
        else:
            game.scoreB += 2

        i += 1
        drive, fieldPosition = simDrive(game, i, 50, game.teamB, game.teamA)
        if not drive.result == "safety":
            game.scoreB += drive.points
        else:
            game.scoreA += 2

    return game


def simDrive(game, driveNum, fieldPosition, offense, defense):
    passFreq = 0.5

    drive = Drive(game, driveNum, offense, defense, fieldPosition)

    while not drive.result:
        for down in range(1, 5):
            play = Play(game, drive, offense, defense, fieldPosition, down)

            if down == 1:
                if fieldPosition >= 90:  # check if first and goal
                    yardsLeft = 100 - fieldPosition
                else:
                    yardsLeft = 10

            play.yardsLeft = yardsLeft

            if down == 4:  # 4th down logic
                decision = sim.fouthDown(fieldPosition, yardsLeft)

                if decision == "field goal":
                    play.playType = "field goal attempt"
                    play.yardsGained = 0
                    play.result = "made field goal"

                    drive.result = "field goal"
                    drive.points = 3

                    return drive, 20

                elif decision == "punt":
                    play.playType = "punt"
                    play.yardsGained = 0
                    play.result = "punt"

                    drive.result = "punt"
                    drive.points = 0

                    return drive, 100 - (fieldPosition + 40)

            if (
                random.random() < passFreq
            ):  # determine if pass or run occurs if not doing special teams play
                result = sim.simPass(fieldPosition, offense, defense)
                play.playType = "pass"

                if result["outcome"] == "interception":
                    play.yardsGained = 0
                    play.result = "interception"

                    drive.result = "interception"
                    drive.points = 0

                    return drive, 100 - fieldPosition

            else:  # if run
                result = sim.simRun(fieldPosition, offense, defense)
                play.playType = "run"

                if result["outcome"] == "fumble":
                    play.yardsGained = 0
                    play.result = "fumble"

                    drive.result = "fumble"
                    drive.points = 0

                    return drive, 100 - fieldPosition

            yardsGained = result["yards"]

            if yardsGained + fieldPosition >= 100:  # adjust if touchdown
                play.yardsGained = yardsGained
                play.result = result["outcome"]

                drive.result = "touchdown"
                drive.points = 7

                return drive, 20

            yardsLeft -= yardsGained
            fieldPosition += yardsGained

            play.yardsGained = yardsGained
            play.result = result["outcome"]

            if down == 4 and yardsLeft > 0:
                drive.result = "turnover on downs"
                drive.points = 0

                return drive, 100 - fieldPosition
            if fieldPosition < 1:
                drive.result = "safety"
                drive.points = 0

                return drive, 20

            if yardsLeft <= 0:  # new set of downs if first down has been made
                break


def getWinProb(teamARating, teamBRating):
    power = 15
    sum = (teamARating**power) + (teamBRating**power)
    teamAChance = (teamARating**power) / sum
    return teamAChance


def getSpread(gap, tax_factor=0.05):
    odds = {}

    for i in range(gap + 1):
        teamA = Team(i)
        teamB = Team(0)
        results = testGame(teamA, teamB)

        spread = (
            round((results["scoreA"] - results["scoreB"]) * 2) / 2
        )  # round to nearest half-point

        if spread > 0:  # teamA is expected to win
            spreadA = (
                "-" + str(int(spread)) if spread.is_integer() else "-" + str(spread)
            )
            spreadB = (
                "+" + str(int(spread)) if spread.is_integer() else "+" + str(spread)
            )
        elif spread < 0:  # teamB is expected to win
            spreadA = (
                "+" + str(abs(int(spread)))
                if spread.is_integer()
                else "+" + str(abs(spread))
            )
            spreadB = (
                "-" + str(abs(int(spread)))
                if spread.is_integer()
                else "-" + str(abs(spread))
            )
        else:
            spreadA = "Even"
            spreadB = "Even"

        implied_probA = round(results["winA"] + (tax_factor / 2), 2)
        implied_probB = round(results["winB"] + (tax_factor / 2), 2)

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
            moneylineA = f"-{moneylineA}"
        else:
            moneylineA = round(((1 / implied_probA) - 1) * 100)
            moneylineA = f"+{moneylineA}"

        if implied_probB > 0.5:
            moneylineB = round(implied_probB / (1 - implied_probB) * 100)
            moneylineB = f"-{moneylineB}"
        else:
            moneylineB = round(((1 / implied_probB) - 1) * 100)
            moneylineB = f"+{moneylineB}"

        odds[i] = {
            "favSpread": spreadA,
            "udSpread": spreadB,
            "favWinProb": implied_probA,
            "udWinProb": implied_probB,
            "favMoneyline": moneylineA,
            "udMoneyline": moneylineB,
        }

    return odds


def testGame(teamA, teamB):
    tests = 500
    scoreA = scoreB = 0
    winA = winB = 0

    for i in range(tests):
        game = Game(teamA, teamB)
        simGame(game)

        scoreA += game.scoreA
        scoreB += game.scoreB

        if game.winner == teamA:
            winA += 1
        elif game.winner == teamB:
            winB += 1

    scoreA = round(scoreA / tests, 1)
    scoreB = round(scoreB / tests, 1)
    winA = round(winA / tests, 3)
    winB = round(winB / tests, 3)

    return {
        "scoreA": scoreA,
        "scoreB": scoreB,
        "winA": winA,
        "winB": winB,
    }
