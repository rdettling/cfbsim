#!/usr/bin/env python3
"""
Generate a year config file based on multi-year ratings.
Usage: python get_year.py {year}
"""

import argparse
import json
import os
import subprocess
import sys
from typing import Dict, List, Optional, Tuple


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


def load_ratings_data(year: int) -> Optional[Dict]:
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


def load_template_year(years_dir: str, target_year: int) -> Tuple[int, Dict]:
    """Load the closest year file at or after the target year as a template."""
    year_files = [f for f in os.listdir(years_dir) if f.endswith(".json")]
    if not year_files:
        raise FileNotFoundError(f"No year files found in {years_dir}")

    available_years = sorted(int(f.replace(".json", "")) for f in year_files)
    template_year = next(
        (year for year in available_years if year >= target_year), None
    )
    if template_year is None:
        template_year = max(available_years)
    template_path = os.path.join(years_dir, f"{template_year}.json")
    with open(template_path, "r") as f:
        return template_year, json.load(f)


def build_conf_games_map(years_dir: str, target_year: int) -> Dict[str, int]:
    """Find conference games counts from the closest year file that includes each conference."""
    year_files = [f for f in os.listdir(years_dir) if f.endswith(".json")]
    if not year_files:
        raise FileNotFoundError(f"No year files found in {years_dir}")

    year_data_by_year = {}
    for year_file in year_files:
        year = int(year_file.replace(".json", ""))
        with open(os.path.join(years_dir, year_file), "r") as f:
            year_data_by_year[year] = json.load(f)

    conf_years = {}
    for year, year_data in year_data_by_year.items():
        for conf_name, conf_data in year_data.get("conferences", {}).items():
            conf_years.setdefault(conf_name, []).append(
                (year, conf_data.get("games"))
            )

    conf_games_map = {}
    for conf_name, year_entries in conf_years.items():
        year_entries.sort(key=lambda entry: abs(entry[0] - target_year))
        closest_year, conf_games = year_entries[0]
        if conf_games is None:
            raise ValueError(
                f"Conference '{conf_name}' missing games in {closest_year}.json"
            )
        conf_games_map[conf_name] = conf_games

    return conf_games_map


def normalize_conference(conf: Optional[str]) -> str:
    if not conf or conf.lower() in ["independent", "ind"]:
        return "Independent"
    return conf.strip()


def load_data_for_year(
    year: int, lookback_years: int = 3
) -> Tuple[List[Dict], Dict, Dict]:
    """Load all required data for a specific year."""
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

    data_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", "data"
    )

    with open(os.path.join(data_dir, "teams.json"), "r") as f:
        teams_data = json.load(f)

    with open(os.path.join(data_dir, "prestige_config.json"), "r") as f:
        prestige_config = json.load(f)

    return all_ratings, teams_data, prestige_config


def calculate_average_ranks(all_ratings: List[Dict], target_year: int) -> List[Dict]:
    """Calculate average ranks for teams across multiple years."""
    target_year_teams = set()
    for ratings_data in all_ratings:
        if ratings_data["year"] == target_year:
            target_year_teams = {team["team"] for team in ratings_data["teams"]}
            break

    team_ranks: Dict[str, List[int]] = {}
    for ratings_data in all_ratings:
        for team in ratings_data["teams"]:
            team_name = team["team"]
            if team_name in target_year_teams:
                team_ranks.setdefault(team_name, []).append(team["rank"])

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

        target_tier = min(current_tier, ceiling)

        assigned_tier = target_tier
        if target_tier < current_tier:
            for tier in range(target_tier, 0, -1):
                if teams_in_tiers[tier] < tier_counts.get(tier, 0):
                    assigned_tier = tier
                    break
        else:
            if teams_in_tiers[current_tier] >= tier_counts.get(current_tier, 0):
                current_tier -= 1
                while current_tier > 0 and teams_in_tiers[
                    current_tier
                ] >= tier_counts.get(current_tier, 0):
                    current_tier -= 1
                if current_tier == 0:
                    current_tier = 1
            assigned_tier = current_tier

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


def build_year_data(
    target_year: int,
    template_year: int,
    template_data: Dict,
    target_ratings: Dict,
    teams_with_prestige: List[Dict],
    conf_games_map: Dict[str, int],
) -> Dict:
    prestige_map = {team["name"]: team["prestige"] for team in teams_with_prestige}
    conferences: Dict[str, Dict] = {}
    independents: Dict[str, int] = {}

    for team in target_ratings["teams"]:
        team_name = team["team"]
        conf = normalize_conference(team.get("conference"))
        prestige = prestige_map.get(team_name)
        if prestige is None:
            continue

        if conf == "Independent":
            independents[team_name] = prestige
            continue

        conf_entry = conferences.setdefault(
            conf,
            {
                "games": conf_games_map.get(conf, 5),
                "teams": {},
            },
        )
        conf_entry["teams"][team_name] = prestige

    for conf_name, conf_data in conferences.items():
        conf_games = conf_data["games"]
        team_count = len(conf_data["teams"])
        if conf_games > (team_count - 1):
            raise ValueError(
                f"{conf_name} has {team_count} teams but {conf_games} conference games"
            )

    return {
        "playoff": template_data["playoff"],
        "conferences": conferences,
        "Independent": independents,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a year config file using multi-year ratings"
    )
    parser.add_argument("year", type=int, help="Year to generate (e.g., 2000)")
    args = parser.parse_args()

    years_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "backend",
        "data",
        "years",
    )

    try:
        all_ratings, teams_data, prestige_config = load_data_for_year(
            args.year, lookback_years=3
        )
        template_year, template_data = load_template_year(years_dir, args.year)
        conf_games_map = build_conf_games_map(years_dir, args.year)

        target_year_ratings = next(
            (data for data in all_ratings if data["year"] == args.year), None
        )
        if not target_year_ratings:
            raise FileNotFoundError(f"No ratings data found for {args.year}")

        teams_with_avg_ranks = calculate_average_ranks(all_ratings, args.year)
        tier_counts = calculate_tier_counts(
            prestige_config, len(teams_with_avg_ranks)
        )
        teams_with_prestige = apply_prestige_to_teams(
            teams_with_avg_ranks, teams_data, tier_counts
        )

        year_data = build_year_data(
            args.year,
            template_year,
            template_data,
            target_year_ratings,
            teams_with_prestige,
            conf_games_map,
        )

        output_path = os.path.join(years_dir, f"{args.year}.json")
        with open(output_path, "w") as f:
            json.dump(year_data, f, indent=4)

        print(
            f"Generated {output_path} using template {template_year}.json "
            f"and ratings {args.year - 3}-{args.year}"
        )
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
