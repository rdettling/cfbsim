import json
import sys
import pandas as pd
import subprocess
import os


def load_name_mappings(file_path):
    mappings = {}
    with open(file_path, "r") as file:
        for line in file:
            csv_name, json_name = line.strip().split(" = ")
            mappings[json_name] = csv_name
    return mappings


def update_prestige(year, name_mappings):
    with open(f"years/{year}.json", "r") as file:
        data = json.load(file)

    csv_file = f"srs/{year}.csv"
    if not os.path.exists(csv_file):
        print(f"CSV file for {year} not found. Generating it now...")
        subprocess.run(["python3", "srs.py", year], check=True, cwd="srs")
        print(f"CSV file for {year} generated.")

    srs_data = pd.read_csv(csv_file)
    srs_dict = {row["Team"]: row["Average SRS"] for index, row in srs_data.iterrows()}

    json_team_names = set()
    for conf in data["conferences"]:
        for team in conf["teams"]:
            json_team_names.add(team["name"])
    for team in data.get("independents", []):
        json_team_names.add(team["name"])

    closest_to_zero = min(srs_dict, key=lambda x: abs(srs_dict[x]))

    min_srs = min(srs_dict.values())
    max_srs = max(srs_dict.values())

    def map_srs_to_prestige(srs, min_srs, max_srs):
        if srs == srs_dict[closest_to_zero]:
            return 75
        if srs <= min_srs:
            return 55
        if srs >= max_srs:
            return 95
        # Linear scaling for other values
        scale = (95 - 55) / (max_srs - min_srs)
        return int(round(55 + scale * (srs - min_srs)))

    # Update prestige in JSON data and check for missing teams
    missing_teams = set(srs_dict.keys())  # Start with all teams from the CSV
    for conf in data["conferences"]:
        for team in conf["teams"]:
            team_name_in_csv = name_mappings.get(team["name"], team["name"])
            if team_name_in_csv in missing_teams:
                team_srs = srs_dict[team_name_in_csv]
                team["prestige"] = map_srs_to_prestige(team_srs, min_srs, max_srs)
                missing_teams.remove(team_name_in_csv)

    for team in data.get("independents", []):
        team_name_in_csv = name_mappings.get(team["name"], team["name"])
        if team_name_in_csv in missing_teams:
            team_srs = srs_dict[team_name_in_csv]
            team["prestige"] = map_srs_to_prestige(team_srs, min_srs, max_srs)
            missing_teams.remove(team_name_in_csv)

    # Save updated JSON data
    with open(f"years/{year}.json", "w") as file:
        json.dump(data, file, indent=4)

    # Report missing teams
    if missing_teams:
        print(
            f"Warning: The following teams from the CSV were not found in the JSON data: {', '.join(missing_teams)}"
        )
    else:
        print("All teams from the CSV were successfully matched in the JSON data.")


if __name__ == "__main__":
    year = sys.argv[1]
    name_mappings = load_name_mappings("name_mapping.txt")
    update_prestige(year, name_mappings)
