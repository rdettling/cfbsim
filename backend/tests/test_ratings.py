import random
import statistics
from typing import Dict, List, Tuple
import unittest
from django.test import TestCase
from logic.player_generation import generate_player_ratings
from logic.roster_management import calculate_team_ratings_from_players
from backend.logic.constants.player_constants import *


def simulate_team(prestige_tier: int) -> Tuple[float, float]:
    """
    Simulate a team using the actual team rating calculation logic from roster_management.py
    prestige_tier: 1-7
    Returns: (team overall from 0-100, average star rating)
    """
    assert 1 <= prestige_tier <= 7, "Prestige must be between 1 and 7"

    players_data = []
    total_stars = 0
    total_players = 0

    # Generate players for all starter positions
    for pos, position_config in ROSTER.items():
        for _ in range(position_config["starters"]):
            # Generate player ratings
            fr, so, jr, sr, star_rating, development_trait = generate_player_ratings(
                prestige_tier
            )

            # Randomly assign player year (1-4)
            player_year = random.randint(1, 4)

            # Get the appropriate rating for the player's year
            if player_year == 1:
                player_rating = fr
            elif player_year == 2:
                player_rating = so
            elif player_year == 3:
                player_rating = jr
            else:  # player_year == 4
                player_rating = sr

            # Add player data
            players_data.append(
                {
                    "pos": pos,
                    "rating": player_rating,
                    "starter": True,  # All players in ROSTER are starters
                }
            )

            total_stars += star_rating
            total_players += 1

    # Calculate team ratings using the actual logic
    team_ratings = calculate_team_ratings_from_players(players_data)
    average_stars = total_stars / total_players

    # Clamp to 0–100
    final_rating = max(0, min(100, team_ratings["overall"]))

    return final_rating, round(average_stars, 2)


def compare_teams(team1: Dict, team2: Dict, num_simulations: int = 100) -> Dict:
    """
    Compare two teams over multiple simulations and count how many times team1 has a higher rating.

    Args:
        team1: Dict with 'name', 'prestige'
        team2: Dict with 'name', 'prestige'
        num_simulations: Number of times to simulate team ratings

    Returns:
        Dict with comparison statistics
    """
    team1_higher_count = 0
    team1_ratings = []
    team2_ratings = []
    team1_stars = []
    team2_stars = []

    for _ in range(num_simulations):
        rating1, stars1 = simulate_team(team1["prestige"])
        rating2, stars2 = simulate_team(team2["prestige"])

        team1_ratings.append(rating1)
        team2_ratings.append(rating2)
        team1_stars.append(stars1)
        team2_stars.append(stars2)

        if rating1 > rating2:
            team1_higher_count += 1

    # Calculate statistics
    stats = {
        "team1": {
            "name": team1["name"],
            "prestige": team1["prestige"],
            "avg_rating": round(statistics.mean(team1_ratings), 2),
            "min_rating": min(team1_ratings),
            "max_rating": max(team1_ratings),
            "std_dev": round(statistics.stdev(team1_ratings), 2),
            "avg_stars": round(statistics.mean(team1_stars), 2),
        },
        "team2": {
            "name": team2["name"],
            "prestige": team2["prestige"],
            "avg_rating": round(statistics.mean(team2_ratings), 2),
            "min_rating": min(team2_ratings),
            "max_rating": max(team2_ratings),
            "std_dev": round(statistics.stdev(team2_ratings), 2),
            "avg_stars": round(statistics.mean(team2_stars), 2),
        },
        "team1_higher_count": team1_higher_count,
        "team1_higher_percentage": round(
            (team1_higher_count / num_simulations) * 100, 1
        ),
        "total_simulations": num_simulations,
        "avg_rating_diff": round(
            statistics.mean(team1_ratings) - statistics.mean(team2_ratings), 2
        ),
    }

    return stats


def print_comparison_results(stats: Dict):
    """Print detailed results of team comparison."""
    print("=" * 80)
    print(f"TEAM COMPARISON: {stats['team1']['name']} vs {stats['team2']['name']}")
    print(f"Simulations: {stats['total_simulations']}")
    print("=" * 80)

    # Team 1 stats
    print(f"\n{stats['team1']['name']} (Prestige {stats['team1']['prestige']}):")
    print(f"  Average Star Rating: {stats['team1']['avg_stars']}")
    print(f"  Average Team Rating: {stats['team1']['avg_rating']}")
    print(
        f"  Rating Range: {stats['team1']['min_rating']} - {stats['team1']['max_rating']}"
    )
    print(f"  Standard Deviation: {stats['team1']['std_dev']}")

    # Team 2 stats
    print(f"\n{stats['team2']['name']} (Prestige {stats['team2']['prestige']}):")
    print(f"  Average Star Rating: {stats['team2']['avg_stars']}")
    print(f"  Average Team Rating: {stats['team2']['avg_rating']}")
    print(
        f"  Rating Range: {stats['team2']['min_rating']} - {stats['team2']['max_rating']}"
    )
    print(f"  Standard Deviation: {stats['team2']['std_dev']}")

    # Comparison results
    print(f"\nCOMPARISON RESULTS:")
    print(
        f"  {stats['team1']['name']} had higher rating: {stats['team1_higher_count']} times"
    )
    print(f"  Percentage: {stats['team1_higher_percentage']}%")
    print(f"  Average Rating Difference: {stats['avg_rating_diff']}")

    # Summary
    if stats["team1_higher_percentage"] > 50:
        print(f"\n🏆 {stats['team1']['name']} typically has a higher rating!")
    elif stats["team1_higher_percentage"] < 50:
        print(f"\n🏆 {stats['team2']['name']} typically has a higher rating!")
    else:
        print(f"\n🤝 Teams are evenly matched!")


def test_individual_player_creation():
    """Test individual player creation to see the rating system in action."""
    print("🧪 INDIVIDUAL PLAYER CREATION TEST")
    print("=" * 80)

    test_prestiges = [1, 4, 7]

    for prestige in test_prestiges:
        print(f"\nPrestige {prestige} Team:")
        print("-" * 40)

        # Create 5 sample players
        for i in range(5):
            fr, so, jr, sr, stars, dev_trait = generate_player_ratings(prestige)
            print(
                f"Player {i+1}: {stars}★, Dev {dev_trait}, Ratings: Fr:{fr} So:{so} Jr:{jr} Sr:{sr}"
            )


def run_rating_tests():
    """Main function to run all rating tests."""
    print("🏈 COLLEGE FOOTBALL RATING SYSTEM TEST")
    print("Testing the integrated star-based rating system")
    print("=" * 80)

    # Test individual player creation
    test_individual_player_creation()

    # Define two teams to compare
    team_1 = {
        "name": "Alabama",
        "prestige": 7,
    }

    team_2 = {
        "name": "Boise State",
        "prestige": 4,
    }

    print("\n\n" + "=" * 80)
    print("TEAM COMPARISON TEST")
    print("=" * 80)

    # Run comparison
    stats = compare_teams(team_1, team_2, num_simulations=100)
    print_comparison_results(stats)

    print("\n\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
