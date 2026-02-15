#!/usr/bin/env python3
"""
Script to scrape Sports Reference for college football team ratings and AP poll rankings.
Usage: python get_ratings.py {year}
"""

import sys
import json
import requests
from bs4 import BeautifulSoup
import argparse
from typing import Dict, List, Optional

# Conference name lookup dictionary
CONFERENCE_LOOKUP = {"Ind": "Independent"}

TEAM_NAME_LOOKUP = {
    "Miami (FL)": "Miami",
    "SMU": "Southern Methodist",
    "North Carolina State": "NC State",
    "Nevada-Las Vegas": "UNLV",
    "Pitt": "Pittsburgh",
    "Miami (OH)": "Miami Ohio",
    "UCF": "Central Florida",
    "UTSA": "Texas San Antonio",
    "Sam Houston": "Sam Houston State",
    "Southern Mississippi": "Southern Miss",
    "Louisiana-Monroe": "Louisiana Monroe",
    "UAB": "Alabama Birmingham",
    "UTEP": "Texas El Paso",
}


def scrape_ratings(year: int) -> List[Dict]:
    """
    Scrape team ratings from Sports Reference for the given year.

    Args:
        year: The year to scrape data for

    Returns:
        List of dictionaries containing team data with SRS and AP poll rankings
    """
    url = f"https://www.sports-reference.com/cfb/years/{year}-ratings.html"

    try:
        response = requests.get(url)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return []

    soup = BeautifulSoup(response.content, "html.parser")

    # Find the main table with team ratings
    table = soup.find("table", {"id": "ratings"})
    if not table:
        print("Could not find ratings table on the page")
        return []

    teams = []

    # Find all rows in the table body
    rows = table.find("tbody").find_all("tr")

    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 8:  # Skip rows that don't have enough data
            continue

        try:
            # Extract team name and link
            team_cell = row.find("td", {"data-stat": "school_name"})
            if not team_cell:
                continue

            team_link = team_cell.find("a")
            raw_team_name = (
                team_link.text.strip() if team_link else team_cell.text.strip()
            )
            team_name = TEAM_NAME_LOOKUP.get(raw_team_name, raw_team_name)

            # Extract conference
            conf_cell = row.find("td", {"data-stat": "conf_abbr"})
            conference = ""
            if conf_cell:
                conf_link = conf_cell.find("a")
                raw_conference = (
                    conf_link.text.strip() if conf_link else conf_cell.text.strip()
                )
                conference = CONFERENCE_LOOKUP.get(raw_conference, raw_conference)

            # Extract AP rank
            ap_cell = row.find("td", {"data-stat": "rank_final"})
            ap_rank = ap_cell.text.strip() if ap_cell else ""

            # Convert rank to number if it exists and is not empty
            if ap_rank and ap_rank != "":
                try:
                    ap_rank = int(ap_rank)
                except ValueError:
                    ap_rank = None
            else:
                ap_rank = None

            # Extract wins and losses
            wins_cell = row.find("td", {"data-stat": "wins"})
            wins = wins_cell.text.strip() if wins_cell else "0"

            losses_cell = row.find("td", {"data-stat": "losses"})
            losses = losses_cell.text.strip() if losses_cell else "0"

            # Convert wins and losses to numbers
            try:
                wins = int(wins)
            except ValueError:
                wins = 0

            try:
                losses = int(losses)
            except ValueError:
                losses = 0

            # Extract SRS (Simple Rating System) for sorting unranked teams
            srs_cell = row.find("td", {"data-stat": "srs"})
            srs = srs_cell.text.strip() if srs_cell else ""

            # Convert SRS to number if it exists and is not empty
            if srs and srs != "":
                try:
                    srs = float(srs)
                except ValueError:
                    srs = None
            else:
                srs = None

            team_data = {
                "team": team_name,
                "conference": conference,
                "rank": ap_rank,
                "wins": wins,
                "losses": losses,
            }

            teams.append(team_data)

        except Exception as e:
            print(f"Error processing row: {e}")
            continue

    return teams


def assign_ranks_to_unranked_teams(teams: List[Dict]) -> List[Dict]:
    """Assign ranks to unranked teams based on SRS, then sort by rank."""

    # Separate ranked and unranked teams
    ranked_teams = [team for team in teams if team["rank"] is not None]
    unranked_teams = [team for team in teams if team["rank"] is None]

    # Sort unranked teams by SRS (higher SRS = better rank)
    unranked_teams.sort(key=lambda x: x.get("srs", float("-inf")), reverse=True)

    # Assign sequential ranks to unranked teams starting after the highest ranked team
    if ranked_teams:
        max_rank = max(team["rank"] for team in ranked_teams)
        next_rank = max_rank + 1
    else:
        next_rank = 1

    for team in unranked_teams:
        team["rank"] = next_rank
        next_rank += 1

    # Combine and sort all teams by rank
    all_teams = ranked_teams + unranked_teams
    all_teams.sort(key=lambda x: x["rank"])

    return all_teams


def main():
    parser = argparse.ArgumentParser(
        description="Scrape college football team ratings from Sports Reference"
    )
    parser.add_argument("year", type=int, help="Year to scrape data for (e.g., 2024)")

    args = parser.parse_args()

    print(f"Scraping ratings for {args.year}...")
    teams = scrape_ratings(args.year)

    if not teams:
        print(
            "No data found. The year might not be available or the page structure may have changed."
        )
        sys.exit(1)

    # Assign ranks to unranked teams and sort
    teams_with_ranks = assign_ranks_to_unranked_teams(teams)

    # Remove SRS from final output (it was only used for sorting)
    for team in teams_with_ranks:
        if "srs" in team:
            del team["srs"]

    # Prepare output data
    output_data = {
        "year": args.year,
        "teams": teams_with_ranks,
        "total_teams": len(teams_with_ranks),
    }

    # Determine output file
    import os

    # Create the ratings directory path
    ratings_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "backend",
        "data",
        "ratings",
    )

    # Ensure the directory exists
    os.makedirs(ratings_dir, exist_ok=True)

    # Default to the ratings directory
    output_file = os.path.join(ratings_dir, f"ratings_{args.year}.json")

    # Write to JSON file
    try:
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"Successfully scraped {len(teams)} teams")
        print(f"Data saved to {output_file}")
    except Exception as e:
        print(f"Error writing to file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
