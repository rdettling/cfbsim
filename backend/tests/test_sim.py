import sys
import os
import django

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cfbsim.settings")
django.setup()

from logic.sim.sim import *
from logic.betting import testGame, Team
from logic.constants.sim_constants import TEST_SIMULATIONS, TEST_SIM_RATING_DIFF


def test_yards(
    team1, team2, yards_function, function_name, simulations=TEST_SIMULATIONS
):
    """
    Generic test function for any yards function.

    Args:
        team1: Offensive team
        team2: Defensive team
        yards_function: Function to test (e.g., passYards, runYards, sackYards)
        function_name: Name of the function for display purposes
        simulations: Number of simulations to run
    """
    print(f"\n📊 {function_name.upper()} TEST")

    # Handle functions that don't take arguments (like sackYards)
    if yards_function.__name__ == "sackYards":
        print("Sack yards (no team ratings)")
        results = [yards_function() for _ in range(simulations)]
    else:
        print(f"Offense rating: {team1.offense} Defense rating: {team2.defense}")
        results = [yards_function(team1, team2) for _ in range(simulations)]

    print("-" * 50)
    results.sort()

    # Compute the percentiles
    percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99]
    for p in percentiles:
        index = int(p / 100 * simulations) - 1  # Subtract 1 because lists are 0-based
        print(f"{p:2d}th Percentile: {results[index]:6.1f} yards")

    average_yards = sum(results) / simulations
    print(f"Average Yards: {average_yards:.2f}")
    print(f"Min Yards: {min(results):.1f}")
    print(f"Max Yards: {max(results):.1f}")


def run_sim_tests():
    """Main function to run all simulation tests."""
    print("🏈 COLLEGE FOOTBALL SIMULATION TEST")
    print("Testing the game simulation system")
    print("=" * 80)

    # Test basic team creation
    print("\n🧪 BASIC TEAM TEST")
    print("-" * 40)
    a = Team(90)
    b = Team(90 - TEST_SIM_RATING_DIFF)
    print(f"Team A Rating: {a.rating}")
    print(f"Team B Rating: {b.rating}")

    # Test game simulation
    print("\n🎮 GAME SIMULATION TEST")
    print("-" * 40)
    game_results = testGame(a, b)
    print(f"Team A Score: {game_results['scoreA']}")
    print(f"Team B Score: {game_results['scoreB']}")
    print(f"Team A Win %: {game_results['winA']:.1%}")
    print(f"Team B Win %: {game_results['winB']:.1%}")

    # Test yards simulation
    print("\n📏 YARDS SIMULATION TESTS")
    print("-" * 40)

    # Test each yards function
    test_yards(a, b, passYards, "pass", TEST_SIMULATIONS)
    test_yards(a, b, runYards, "run", TEST_SIMULATIONS)
    test_yards(a, b, sackYards, "sack", TEST_SIMULATIONS)

    print("\n\n" + "=" * 80)
    print("SIMULATION TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    run_sim_tests()
