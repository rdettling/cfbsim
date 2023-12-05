import random

try:
    from .sim import *
except ImportError:
    from sim import *


def testRun(team1, team2, simulations=10000):
    print(f"Offense rating: {team1.offense} Defense rating: {team2.defense}")

    results = [runYards(team1, team2) for _ in range(simulations)]
    results.sort()

    # Compute the percentiles
    percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
    for p in percentiles:
        index = int(p / 100 * simulations) - 1  # Subtract 1 because lists are 0-based
        print(f"{p}th Percentile Yards Gained: {results[index]}")

    average_yards = sum(results) / simulations
    print(f"Average Yards Gained: {average_yards}")


def testPass(team1, team2, simulations=10000):
    print(f"Offense rating: {team1.offense} Defense rating: {team2.defense}")

    results = [passYards(team1, team2) for _ in range(simulations)]
    results.sort()

    # Compute the percentiles
    percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
    for p in percentiles:
        index = int(p / 100 * simulations) - 1  # Subtract 1 because lists are 0-based
        print(f"{p}th Percentile Yards Gained: {results[index]}")

    average_yards = sum(results) / simulations
    print(f"Average Yards Gained: {average_yards}")


def testSack(team1, team2, simulations=10000):
    print(f"Offense rating: {team1.offense} Defense rating: {team2.defense}")

    results = [sackYards(team1, team2) for _ in range(simulations)]
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

    print(f"Offense rating: {team1.offense} Defense rating: {team2.defense}")

    passYards_total = 0
    rushYards_total = sum([runYards(team1, team2) for _ in range(simulations)])

    # simulate passYards
    for _ in range(simulations):
        if random.random() < comp:
            passYards_total += passYards(team1, team2)
        # else it's an incomplete pass and we increment by 0, so do nothing

    average = (passYards_total + rushYards_total) / (2 * simulations)

    print(f"Average yards per play: {average}")
    print(f"Average yards per rush: {rushYards_total / simulations}")
    print(f"Average yards per pass: {passYards_total / simulations}")


def getWinProb(teamARating, teamBRating):
    power = 15
    sum = (teamARating**power) + (teamBRating**power)
    teamAChance = (teamARating**power) / sum
    return teamAChance


def testGame(teamA, teamB):
    tests = 200
    scoreA = scoreB = 0
    winA = winB = 0

    for _ in range(tests):
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
            "favWinProb": results["winA"],
            "udWinProb": results["winB"],
            "favMoneyline": moneylineA,
            "udMoneyline": moneylineB,
        }

    return odds


a = Team(90)
b = Team(90)

# print(testGame(a, b))
