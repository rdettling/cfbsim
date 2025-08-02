from logic.sim.sim import simGame


def getSpread(gap, tax_factor=0.05):
    """Generate spread and odds data for different rating gaps."""
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
                else "+" + str(abs(spread))
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


def testGame(teamA, teamB):
    """Test game simulation between two teams."""
    tests = 100
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