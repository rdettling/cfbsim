#!/usr/bin/env python3
"""
Generate sample rosters for each prestige level and report average team ratings.
Usage: python scripts/test_recruit_rosters.py
"""

import os
import sys
import statistics
from dataclasses import dataclass

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.append(BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cfbsim.settings")
import django

django.setup()

from logic.constants.player_constants import ROSTER, RECRUIT_CLASS_YEARS
from logic.player_generation import load_names
from logic.roster_management import (
    _assign_recruits_to_teams,
    _generate_recruit_pool,
    _load_state_weights,
    calculate_team_ratings,
)


@dataclass
class TeamStub:
    id: int
    prestige: int


def build_league(teams_per_prestige=10):
    teams = []
    team_id = 1
    for prestige in range(1, 8):
        for _ in range(teams_per_prestige):
            teams.append(TeamStub(id=team_id, prestige=prestige))
            team_id += 1
    return teams


def advance_roster(roster):
    for player in roster:
        if player["year"] == "fr":
            player["year"] = "so"
            player["rating"] = player["rating_so"]
        elif player["year"] == "so":
            player["year"] = "jr"
            player["rating"] = player["rating_jr"]
        elif player["year"] == "jr":
            player["year"] = "sr"
            player["rating"] = player["rating_sr"]
    return roster


def select_starters(roster):
    starters = []
    for pos, config in ROSTER.items():
        candidates = [player for player in roster if player["pos"] == pos]
        candidates.sort(key=lambda player: player["rating"], reverse=True)
        for player in candidates[: config["starters"]]:
            starters.append(
                {"pos": player["pos"], "rating": player["rating"], "starter": True}
            )
    return starters


def simulate_team_overall(prestige, runs=10, teams_per_prestige=10):
    results = []
    loaded_names = load_names()
    state_weights = _load_state_weights()
    for _ in range(runs):
        teams = build_league(teams_per_prestige=teams_per_prestige)
        target_team = next(team for team in teams if team.prestige == prestige)
        roster = []

        for cycle in range(RECRUIT_CLASS_YEARS):
            if cycle > 0:
                advance_roster(roster)

            recruits = _generate_recruit_pool(loaded_names, state_weights)
            roster_counts = {team.id: {pos: 0 for pos in ROSTER} for team in teams}
            for player in roster:
                roster_counts[target_team.id][player["pos"]] += 1
            team_needs = {
                team.id: {
                    pos: max(0, ROSTER[pos]["total"] - roster_counts[team.id][pos])
                    for pos in ROSTER
                }
                for team in teams
            }
            assignments = _assign_recruits_to_teams(
                teams, recruits, team_needs, loaded_names, state_weights
            )

            for recruit in assignments[target_team.id]:
                roster.append(
                    {
                        "pos": recruit["pos"],
                        "year": "fr",
                        "rating": recruit["rating_fr"],
                        "rating_fr": recruit["rating_fr"],
                        "rating_so": recruit["rating_so"],
                        "rating_jr": recruit["rating_jr"],
                        "rating_sr": recruit["rating_sr"],
                    }
                )

        starters = select_starters(roster)
        ratings = calculate_team_ratings(players_data=starters)
        results.append(ratings["overall"])

    return results


def main():
    runs = 10
    print(f"Simulating {runs} recruiting cycles per prestige level...")

    for prestige in range(1, 8):
        results = simulate_team_overall(prestige, runs=runs)
        avg_rating = statistics.mean(results)
        min_rating = min(results)
        max_rating = max(results)
        print(
            f"Prestige {prestige}: avg {avg_rating:.1f}, min {min_rating}, max {max_rating}"
        )


if __name__ == "__main__":
    main()
