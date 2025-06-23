import random
from logic.sim.sim import *
from logic.sim.sim_helper import testGame, Team, Game


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


def run_sim_tests():
    """Main function to run all simulation tests."""
    print("🏈 COLLEGE FOOTBALL SIMULATION TEST")
    print("Testing the game simulation system")
    print("=" * 80)
    
    # Test basic team creation
    print("\n🧪 BASIC TEAM TEST")
    print("-" * 40)
    a = Team(90)
    b = Team(90)
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
    print("\n📏 YARDS SIMULATION TEST")
    print("-" * 40)
    testYards(a, b, simulations=1000)
    
    print("\n\n" + "=" * 80)
    print("SIMULATION TEST COMPLETE")
    print("=" * 80)
