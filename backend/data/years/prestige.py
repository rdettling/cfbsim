import json

# Map prestige score (60–100) to tier (1–7)
def prestige_to_tier(score):
    if score <= 64:
        return 1
    elif score <= 69:
        return 2
    elif score <= 74:
        return 3
    elif score <= 79:
        return 4
    elif score <= 84:
        return 5
    elif score <= 92:
        return 6
    else:
        return 7

# Normalize and reorder a team dictionary
def normalize_team(team):
    prestige_raw = team.get("prestige", 70)
    prestige = prestige_raw if 1 <= prestige_raw <= 7 else prestige_to_tier(prestige_raw)

    floor_raw = team.get("floor")
    floor = prestige_to_tier(floor_raw) if floor_raw and not (1 <= floor_raw <= 7) else floor_raw
    if floor is None:
        floor = max(1, prestige - 2)

    ceiling_raw = team.get("ceiling")
    ceiling = prestige_to_tier(ceiling_raw) if ceiling_raw and not (1 <= ceiling_raw <= 7) else ceiling_raw
    if ceiling is None:
        ceiling = prestige

    # Return keys in the desired order
    return {
        "name": team.get("name"),
        "mascot": team.get("mascot"),
        "abbreviation": team.get("abbreviation"),
        "prestige": prestige,
        "ceiling": ceiling,
        "floor": floor,
        "colorPrimary": team.get("colorPrimary"),
        "colorSecondary": team.get("colorSecondary")
    }

# Load original JSON
with open("2024.json", "r") as f:
    data = json.load(f)

# Normalize teams in conferences
for i, conference in enumerate(data.get("conferences", [])):
    new_teams = []
    for team in conference.get("teams", []):
        new_teams.append(normalize_team(team))
    data["conferences"][i]["teams"] = new_teams

# Normalize independent teams
new_independents = []
for team in data.get("independents", []):
    new_independents.append(normalize_team(team))
data["independents"] = new_independents

# Write to file with pretty formatting
with open("data_updated.json", "w") as f:
    json.dump(data, f, indent=4)
