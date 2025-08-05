#!/usr/bin/env python3
"""
Script to apply prestige tiers to teams based on multi-year average rankings.
Usage: python apply_prestige.py
"""

import sys
import json
import argparse
import os
import subprocess
from typing import Dict, List, Tuple


def fetch_missing_year_data(year: int) -> bool:
    """Fetch ratings data for a missing year using get_ratings.py."""
    print(f"Fetching ratings data for {year}...")

    script_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "backend",
        "scripts",
        "get_ratings.py",
    )

    try:
        subprocess.run(
            [sys.executable, script_path, str(year)],
            capture_output=True,
            text=True,
            check=True,
        )
        print(f"Successfully fetched {year} data")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error fetching {year} data: {e}")
        return False


def load_ratings_data(year: int) -> Dict:
    """Load ratings data for a specific year, fetching if missing."""
    ratings_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "backend",
        "data",
        "ratings",
        f"ratings_{year}.json",
    )

    if not os.path.exists(ratings_file):
        if not fetch_missing_year_data(year):
            return None

    try:
        with open(ratings_file, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Could not load ratings data for {year}")
        return None


def load_data_for_year(
    year: int, lookback_years: int = 3
) -> Tuple[List[Dict], Dict, Dict]:
    """Load all required data for a specific year."""

    # Load ratings from multiple years
    all_ratings = []
    years_to_check = range(year - lookback_years, year + 1)

    for check_year in years_to_check:
        ratings_data = load_ratings_data(check_year)
        if ratings_data:
            if any(
                team["wins"] > 0 or team["losses"] > 0 for team in ratings_data["teams"]
            ):
                all_ratings.append(ratings_data)
            else:
                print(f"Skipping {check_year} - data appears to be empty/placeholder")
        else:
            print(f"Skipping {check_year} - no data available")

    if not all_ratings:
        raise FileNotFoundError("No ratings data available for any year")

    # Load teams and prestige config
    data_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", "data"
    )

    with open(os.path.join(data_dir, "teams.json"), "r") as f:
        teams_data = json.load(f)

    with open(os.path.join(data_dir, "prestige_config.json"), "r") as f:
        prestige_config = json.load(f)

    return all_ratings, teams_data, prestige_config


def calculate_average_ranks(all_ratings: List[Dict], target_year: int) -> List[Dict]:
    """Calculate average ranks for teams across multiple years, but only include teams present in target year."""
    # Get teams present in target year
    target_year_teams = set()
    for ratings_data in all_ratings:
        if ratings_data["year"] == target_year:
            target_year_teams = {team["team"] for team in ratings_data["teams"]}
            break

    # Collect ranks for teams present in target year
    team_ranks = {}
    for ratings_data in all_ratings:
        for team in ratings_data["teams"]:
            team_name = team["team"]
            if team_name in target_year_teams:
                if team_name not in team_ranks:
                    team_ranks[team_name] = []
                team_ranks[team_name].append(team["rank"])

    # Calculate average ranks
    teams_with_avg_ranks = []
    for team_name, ranks in team_ranks.items():
        valid_ranks = [r for r in ranks if r is not None]
        avg_rank = sum(valid_ranks) / len(valid_ranks) if valid_ranks else None

        teams_with_avg_ranks.append(
            {
                "team": team_name,
                "rank": avg_rank,
                "years_counted": len(valid_ranks),
                "total_years": len(ranks),
            }
        )

    return sorted(
        teams_with_avg_ranks,
        key=lambda x: (x["rank"] is None, x["rank"] or float("inf")),
    )


def find_team_issues(teams_with_avg_ranks: List[Dict], teams_data: Dict) -> List[str]:
    """Find teams in ratings that don't exist in teams.json."""
    teams_in_data = set(teams_data["teams"].keys())
    return [
        team["team"]
        for team in teams_with_avg_ranks
        if team["team"] not in teams_in_data
    ]


def find_year_issues(
    year_data: Dict, teams_with_prestige: List[Dict], ratings_data: Dict
) -> Tuple[List[str], List[str], List[Tuple[str, str, str]], List[str]]:
    """Find all issues with the year data: extra teams, missing teams, conference mismatches, and duplicates."""

    # Get teams from year JSON
    teams_in_year = set()
    for conf_name, conf_data in year_data["conferences"].items():
        for team_name in conf_data["teams"]:
            teams_in_year.add(team_name)
    for team_name in year_data["Independent"]:
        teams_in_year.add(team_name)

    # Get teams from ratings
    teams_in_ratings = {team["name"] for team in teams_with_prestige}
    ratings_conferences = {}
    for team in ratings_data["teams"]:
        team_name = team["team"]
        ratings_conf = team.get("conference")
        if ratings_conf and ratings_conf.lower() in ["independent", "ind"]:
            ratings_conf = "Independent"
        ratings_conferences[team_name] = ratings_conf

    # Find extra teams in year JSON (not in ratings)
    extra_in_year = []
    for team_name in teams_in_year:
        found_in_ratings = False
        for ratings_team in teams_with_prestige:
            if ratings_team["name"] == team_name:
                found_in_ratings = True
                break
        if not found_in_ratings:
            extra_in_year.append(team_name)

    # Find missing teams from ratings (not in year JSON)
    missing_from_year = []
    for ratings_team in teams_with_prestige:
        if ratings_team["name"] not in teams_in_year:
            missing_from_year.append(ratings_team["name"])

    # Find conference mismatches
    conference_mismatches = []
    for conf_name, conf_data in year_data["conferences"].items():
        for team_name in conf_data["teams"]:
            if team_name in ratings_conferences:
                ratings_conf = ratings_conferences[team_name]
                if ratings_conf and ratings_conf != conf_name:
                    conference_mismatches.append((team_name, conf_name, ratings_conf))

    for team_name in year_data["Independent"]:
        if team_name in ratings_conferences:
            ratings_conf = ratings_conferences[team_name]
            if ratings_conf and ratings_conf != "Independent":
                conference_mismatches.append((team_name, "Independent", ratings_conf))

    # Find duplicate teams
    all_teams = []
    for conf_name, conf_data in year_data["conferences"].items():
        for team_name in conf_data["teams"]:
            all_teams.append(team_name)
    for team_name in year_data["Independent"]:
        all_teams.append(team_name)

    seen = set()
    duplicates = []
    for team_name in all_teams:
        if team_name in seen:
            if team_name not in duplicates:
                duplicates.append(team_name)
        else:
            seen.add(team_name)

    return extra_in_year, missing_from_year, conference_mismatches, duplicates


def calculate_tier_counts(prestige_config: Dict, total_teams: int) -> Dict[int, int]:
    """Calculate how many teams should be in each prestige tier."""
    return {
        int(tier): int((percentage / 100) * total_teams)
        for tier, percentage in prestige_config.items()
    }


def apply_prestige_to_teams(
    teams: List[Dict], teams_data: Dict, tier_counts: Dict[int, int]
) -> List[Dict]:
    """Apply prestige tiers to teams based on their ranking and constraints."""
    result = []
    teams_in_tiers = {tier: 0 for tier in range(1, 8)}
    current_tier = 7

    for team in teams:
        team_name = team["team"]
        team_info = teams_data["teams"].get(team_name, {})
        ceiling = team_info.get("ceiling", 7)
        floor = team_info.get("floor", 1)

        # Find highest tier this team can achieve
        target_tier = min(current_tier, ceiling)

        # Find available tier
        assigned_tier = target_tier
        if target_tier < current_tier:
            # Look for next available tier
            for tier in range(target_tier, 0, -1):
                if teams_in_tiers[tier] < tier_counts.get(tier, 0):
                    assigned_tier = tier
                    break
        else:
            # Check if current tier is full
            if teams_in_tiers[current_tier] >= tier_counts.get(current_tier, 0):
                current_tier -= 1
                while current_tier > 0 and teams_in_tiers[
                    current_tier
                ] >= tier_counts.get(current_tier, 0):
                    current_tier -= 1
                if current_tier == 0:
                    current_tier = 1
            assigned_tier = current_tier

        # Apply prestige respecting constraints
        prestige = min(assigned_tier, ceiling)
        prestige = max(prestige, floor)
        teams_in_tiers[prestige] += 1

        result.append(
            {
                "name": team_name,
                "prestige": prestige,
                "rank": team["rank"],
                "years_counted": team["years_counted"],
                "total_years": team["total_years"],
            }
        )

    return result


def update_year_file(year: int, teams_with_prestige: List[Dict], ratings_data: Dict):
    """Update the year file with new prestige values and check for issues."""
    year_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "backend",
        "data",
        "years",
        f"{year}.json",
    )

    with open(year_file, "r") as f:
        year_data = json.load(f)

    # Check for all issues
    extra_in_year, missing_from_year, conference_mismatches, duplicates = (
        find_year_issues(year_data, teams_with_prestige, ratings_data)
    )

    # Report issues
    if extra_in_year:
        print(
            f"\nWARNING: {len(extra_in_year)} teams in {year}.json not found in ratings data:"
        )
        for team in extra_in_year:
            print(f"  - {team}")

    if missing_from_year:
        print(
            f"\nWARNING: {len(missing_from_year)} teams in ratings data not found in {year}.json:"
        )
        for team in missing_from_year:
            print(f"  - {team}")

    if conference_mismatches:
        print(
            f"\nWARNING: {len(conference_mismatches)} conference mismatches in {year}.json:"
        )
        for team_name, year_conf, ratings_conf in conference_mismatches:
            print(f"  - {team_name}: {year_conf} (year) vs {ratings_conf} (ratings)")

    if duplicates:
        print(f"\nWARNING: {len(duplicates)} duplicate teams found in {year}.json:")
        for team_name in duplicates:
            print(f"  - {team_name}")

    # Update prestige values
    prestige_map = {team["name"]: team["prestige"] for team in teams_with_prestige}

    for conf_name, conf_data in year_data["conferences"].items():
        for team_name in conf_data["teams"]:
            if team_name in prestige_map:
                conf_data["teams"][team_name] = prestige_map[team_name]

    for team_name in year_data["Independent"]:
        if team_name in prestige_map:
            year_data["Independent"][team_name] = prestige_map[team_name]

    # Write updated year file
    with open(year_file, "w") as f:
        json.dump(year_data, f, indent=4)


def main():
    parser = argparse.ArgumentParser(
        description="Apply prestige tiers to teams based on multi-year rankings"
    )

    args = parser.parse_args()

    try:
        # Get all year files
        years_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "backend",
            "data",
            "years",
        )

        if not os.path.exists(years_dir):
            print(f"Error: Years directory not found at {years_dir}")
            sys.exit(1)

        year_files = [f for f in os.listdir(years_dir) if f.endswith(".json")]
        if not year_files:
            print(f"Error: No year files found in {years_dir}")
            sys.exit(1)

        # Load teams, prestige config, and team name lookup
        data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "backend",
            "data",
        )

        with open(os.path.join(data_dir, "teams.json"), "r") as f:
            teams_data = json.load(f)

        with open(os.path.join(data_dir, "prestige_config.json"), "r") as f:
            prestige_config = json.load(f)

        # Process each year file
        for year_file in sorted(year_files):
            year = int(year_file.replace(".json", ""))

            try:
                # Load all data for this year
                all_ratings, _, _ = load_data_for_year(year, lookback_years=3)

                # Get the target year's ratings data for conference checking
                target_year_ratings = None
                for ratings_data in all_ratings:
                    if ratings_data["year"] == year:
                        target_year_ratings = ratings_data
                        break

                if not target_year_ratings:
                    print(f"Error: No ratings data found for {year}")
                    continue

                # Calculate average ranks and sort
                teams_with_avg_ranks = calculate_average_ranks(all_ratings, year)

                # Check for unmatched teams (only show if there are teams not in teams.json)
                unmatched_teams = find_team_issues(teams_with_avg_ranks, teams_data)
                if unmatched_teams:
                    print(
                        f"\nWARNING: {len(unmatched_teams)} teams not found in teams.json for {year}:"
                    )
                    for team in unmatched_teams:
                        print(f"  - {team}")
                    print("You'll need to add these to the teams.json file.")

                # Calculate tier counts and apply prestige
                tier_counts = calculate_tier_counts(
                    prestige_config, len(teams_with_avg_ranks)
                )
                teams_with_prestige = apply_prestige_to_teams(
                    teams_with_avg_ranks, teams_data, tier_counts
                )

                # Update year file
                update_year_file(year, teams_with_prestige, target_year_ratings)

            except FileNotFoundError as e:
                print(f"Error processing {year}: {e}")
                continue
            except Exception as e:
                print(f"Error processing {year}: {e}")
                continue

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
