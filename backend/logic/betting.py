from logic.sim.sim import simGame
from logic.constants.sim_constants import TEST_SIMULATIONS
from api.models import *
import random


def create_test_team(rating=0):
    """Create a test Teams instance for betting calculations (in-memory only)."""
    # Create a minimal Info instance for the team (in-memory only)
    info = Info(
        user_id="test_betting",
        currentWeek=1,
        currentYear=2024,
        startYear=2024,
        lastWeek=15
    )
    
    # Create a test Teams instance (in-memory only)
    team = Teams(
        info=info,
        name=f"Test Team {rating}",
        abbreviation="TST",
        prestige=50,
        rating=rating,
        offense=rating,
        defense=rating,
        mascot="Testers",
        colorPrimary="#000000",
        colorSecondary="#FFFFFF",
        confGames=0,
        confLimit=8,
        confWins=0,
        confLosses=0,
        nonConfGames=0,
        nonConfLimit=4,
        nonConfWins=0,
        nonConfLosses=0,
        gamesPlayed=0,
        totalWins=0,
        totalLosses=0,
        strength_of_record=0.0,
        poll_score=0.0,
        ranking=1,
        last_rank=1,
        offers=0,
        recruiting_points=0
    )
    return team


def getSpread(gap, tax_factor=0.05):
    """Generate spread and odds data for different rating gaps."""
    odds = {}

    for i in range(gap + 1):
        # Create fake Teams instances for testing (in-memory only)
        teamA = create_test_team(rating=i)
        teamB = create_test_team(rating=0)
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
    """Test game simulation between two teams (in-memory only)."""
    scoreA = scoreB = 0
    winA = winB = 0

    for _ in range(TEST_SIMULATIONS):
        # Create a Games instance in-memory only (no database save)
        game = Games(
            info=teamA.info,  # Use the same info instance
            teamA=teamA,
            teamB=teamB,
            base_label="Test Game",
            name="Test Game",
            spreadA="0",
            spreadB="0",
            moneylineA="0",
            moneylineB="0",
            winProbA=0.5,
            winProbB=0.5,
            weekPlayed=1,
            year=2024,
            rankATOG=1,
            rankBTOG=1,
            resultA=None,
            resultB=None,
            overtime=0,
            scoreA=None,
            scoreB=None,
            headline=None,
            watchability=0.0
        )
        
        # Simulate the game (in-memory only)
        simGame(game, teamA.info, [], [], None)  # Pass empty lists for drives and plays, no starters for test games

        scoreA += game.scoreA or 0
        scoreB += game.scoreB or 0

        if game.winner == teamA:
            winA += 1
        elif game.winner == teamB:
            winB += 1

    scoreA = round(scoreA / TEST_SIMULATIONS, 1)
    scoreB = round(scoreB / TEST_SIMULATIONS, 1)
    winA = round(winA / TEST_SIMULATIONS, 3)
    winB = round(winB / TEST_SIMULATIONS, 3)

    return {
        "scoreA": scoreA,
        "scoreB": scoreB,
        "winA": winA,
        "winB": winB,
    }
