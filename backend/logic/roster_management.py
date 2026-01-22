import json
import random
import time
from collections import deque
from api.models import Players, Teams
from .constants.player_constants import (
    DEFENSIVE_WEIGHTS,
    DEFENSE_WEIGHT,
    OFFENSE_WEIGHT,
    OFFENSIVE_WEIGHTS,
    RANDOM_VARIANCE_RANGE,
    RECRUIT_CLASS_YEARS,
    RECRUIT_POSITION_NEED_BIAS,
    RECRUIT_PRESTIGE_BIAS,
    RECRUIT_STAR_COUNTS,
    ROSTER,
)
from .player_generation import (
    load_names,
    create_player_from_recruit,
    generate_player_ratings,
    generateName,
)
from logic.util import time_section


def preview_progression(info):
    """
    Preview seniors leaving and next-year ratings without saving changes.
    Returns: (leaving_players, progressed_payload)
    """
    overall_start = time.time()
    leaving_players = list(info.team.players.filter(year="sr", active=True))
    candidates = list(info.team.players.filter(active=True).exclude(year="sr"))
    progressed = []

    for player in candidates:
        if player.year == "fr":
            next_year = "so"
            next_rating = player.rating_so
        elif player.year == "so":
            next_year = "jr"
            next_rating = player.rating_jr
        else:
            next_year = "sr"
            next_rating = player.rating_sr

        progressed.append(
            {
                "id": player.id,
                "first": player.first,
                "last": player.last,
                "pos": player.pos,
                "year": player.year,
                "rating": player.rating,
                "next_year": next_year,
                "next_rating": next_rating,
                "stars": player.stars,
                "development_trait": player.development_trait,
            }
        )

    time_section(overall_start, "  • Progression preview total")
    return leaving_players, progressed


def apply_progression(info):
    """
    Apply roster progression: remove seniors, advance years, and update ratings.
    """
    overall_start = time.time()

    seniors = info.players.filter(year="sr", active=True)
    seniors.update(active=False, starter=False)

    players = list(info.players.filter(active=True))
    to_update = []
    for player in players:
        if player.year == "fr":
            player.year = "so"
            player.rating = player.rating_so
        elif player.year == "so":
            player.year = "jr"
            player.rating = player.rating_jr
        elif player.year == "jr":
            player.year = "sr"
            player.rating = player.rating_sr
        else:
            continue
        to_update.append(player)

    if to_update:
        Players.objects.bulk_update(to_update, ["year", "rating"])

    time_section(overall_start, "  • Progression applied")


def recruiting_cycle(info, teams, team_needs_override=None):
    """Generate recruits and assign freshmen to teams."""
    loaded_names = load_names()
    state_weights = _load_state_weights()
    recruits = _generate_recruit_pool(loaded_names, state_weights)
    if team_needs_override is None:
        roster_counts = _get_roster_counts(info, teams)
        team_needs = _build_team_needs(teams, roster_counts)
    else:
        team_needs = team_needs_override
    class_assignments = _assign_recruits_to_teams(
        teams, recruits, team_needs, loaded_names, state_weights
    )

    players_to_create = []
    for team_id, team_recruits in class_assignments.items():
        team = next(team for team in teams if team.id == team_id)
        for recruit in team_recruits:
            players_to_create.append(create_player_from_recruit(team, recruit, "fr"))

    if players_to_create:
        Players.objects.bulk_create(players_to_create)


def init_rosters(info):
    """Initialize full rosters by simulating recruiting cycles."""
    teams = list(info.teams.all())
    class_targets = _build_class_targets(teams)
    recruiting_cycle(info, teams, team_needs_override=class_targets)
    for _ in range(RECRUIT_CLASS_YEARS - 1):
        players = list(info.players.filter(active=True))
        to_update = []
        for player in players:
            if player.year == "fr":
                player.year = "so"
                player.rating = player.rating_so
            elif player.year == "so":
                player.year = "jr"
                player.rating = player.rating_jr
            elif player.year == "jr":
                player.year = "sr"
                player.rating = player.rating_sr
            to_update.append(player)
        if to_update:
            Players.objects.bulk_update(to_update, ["year", "rating"])
        recruiting_cycle(info, teams, team_needs_override=class_targets)
    apply_roster_cuts(info)


def _load_state_weights():
    with open("data/states.json", "r") as states_file:
        state_data = json.load(states_file)
    states = list(state_data.keys())
    weights = list(state_data.values())
    return states, weights


def _get_roster_counts(info, teams):
    roster_counts = {team.id: {pos: 0 for pos in ROSTER} for team in teams}
    for team_id, pos in (
        info.players.filter(active=True)
        .values_list("team_id", "pos")
        .iterator()
    ):
        if team_id in roster_counts and pos in roster_counts[team_id]:
            roster_counts[team_id][pos] += 1
    return roster_counts


def _build_team_needs(teams, roster_counts):
    team_needs = {}
    for team in teams:
        needs = {}
        counts = roster_counts.get(team.id, {})
        for pos, config in ROSTER.items():
            needs[pos] = max(0, config["total"] - counts.get(pos, 0))
        team_needs[team.id] = needs
    return team_needs


def _build_class_targets(teams):
    base_targets = {}
    for pos, config in ROSTER.items():
        per_cycle = config["total"] / RECRUIT_CLASS_YEARS
        base_targets[pos] = int(per_cycle) if per_cycle.is_integer() else int(per_cycle) + 1

    min_positions = [
        pos
        for pos, config in ROSTER.items()
        if config["total"] > 0 and config["total"] <= RECRUIT_CLASS_YEARS
    ]
    for pos in min_positions:
        if base_targets.get(pos, 0) == 0:
            base_targets[pos] = 1
    return {team.id: dict(base_targets) for team in teams}


def _generate_recruit_pool(loaded_names, state_weights):
    recruits = []
    states, weights = state_weights
    positions = list(ROSTER.keys())
    position_weights = [ROSTER[pos]["total"] for pos in positions]

    for stars, count in RECRUIT_STAR_COUNTS.items():
        for _ in range(count):
            pos = random.choices(positions, weights=position_weights, k=1)[0]
            first, last = generateName(pos, loaded_names)
            rating_fr, rating_so, rating_jr, rating_sr, development_trait = (
                generate_player_ratings(stars)
            )
            state = random.choices(states, weights=weights, k=1)[0]
            recruits.append(
                {
                    "first": first,
                    "last": last,
                    "pos": pos,
                    "stars": stars,
                    "state": state,
                    "rating_fr": rating_fr,
                    "rating_so": rating_so,
                    "rating_jr": rating_jr,
                    "rating_sr": rating_sr,
                    "development_trait": development_trait,
                }
            )
    return recruits


def _match_recruits_for_position(recruits, teams, position_needs, pos):
    assignments = {team.id: [] for team in teams}
    capacities = {team.id: position_needs[team.id][pos] for team in teams}
    recruit_prefs = {}
    recruit_pref_index = {}
    queue = deque()

    for recruit in recruits:
        eligible = [
            team
            for team in teams
            if capacities[team.id] > 0 and team.prestige >= recruit["stars"]
        ]
        if not eligible:
            continue
        scores = []
        for team in eligible:
            score = (team.prestige**2 * RECRUIT_PRESTIGE_BIAS) + random.uniform(0, 5)
            scores.append((score, team.id))
        scores.sort(reverse=True)
        recruit_prefs[recruit["rid"]] = [team_id for _, team_id in scores]
        recruit_pref_index[recruit["rid"]] = 0
        queue.append(recruit)

    while queue:
        recruit = queue.popleft()
        prefs = recruit_prefs.get(recruit["rid"])
        if not prefs:
            continue
        pref_index = recruit_pref_index[recruit["rid"]]
        if pref_index >= len(prefs):
            continue
        team_id = prefs[pref_index]
        recruit_pref_index[recruit["rid"]] = pref_index + 1

        team_list = assignments[team_id]
        if len(team_list) < capacities[team_id]:
            team_list.append(recruit)
            continue

        new_score = (recruit["stars"] * 100) + recruit["rating_fr"]
        worst_index = None
        worst_score = None
        for idx, current in enumerate(team_list):
            score = (current["stars"] * 100) + current["rating_fr"]
            if worst_score is None or score < worst_score:
                worst_score = score
                worst_index = idx

        if new_score > worst_score:
            replaced = team_list[worst_index]
            team_list[worst_index] = recruit
            queue.append(replaced)
        else:
            queue.append(recruit)

    return assignments


def _assign_recruits_to_teams(
    teams, recruits, team_needs, loaded_names, state_weights
):
    class_assignments = {team.id: [] for team in teams}
    position_remaining = {team.id: dict(team_needs[team.id]) for team in teams}

    for rid, recruit in enumerate(recruits):
        recruit["rid"] = rid

    recruits_by_pos = {pos: [] for pos in ROSTER}
    for recruit in recruits:
        recruits_by_pos[recruit["pos"]].append(recruit)

    for pos, pos_recruits in recruits_by_pos.items():
        if not pos_recruits:
            continue
        pos_assignments = _match_recruits_for_position(
            pos_recruits, teams, position_remaining, pos
        )
        for team_id, recruits_for_team in pos_assignments.items():
            if not recruits_for_team:
                continue
            class_assignments[team_id].extend(recruits_for_team)
            position_remaining[team_id][pos] -= len(recruits_for_team)

    class_remaining = {
        team.id: sum(position_remaining[team.id].values()) for team in teams
    }
    for team in teams:
        while class_remaining[team.id] > 0:
            needs = position_remaining[team.id]
            need_positions = [pos for pos, remaining in needs.items() if remaining > 0]
            if need_positions:
                pos = max(need_positions, key=lambda p: needs[p])
                position_remaining[team.id][pos] -= 1
            else:
                pos = random.choices(
                    list(ROSTER.keys()),
                    weights=[ROSTER[key]["total"] for key in ROSTER],
                    k=1,
                )[0]

            first, last = generateName(pos, loaded_names)
            rating_fr, rating_so, rating_jr, rating_sr, development_trait = (
                generate_player_ratings(1)
            )
            states, weights = state_weights
            state = random.choices(states, weights=weights, k=1)[0]
            class_assignments[team.id].append(
                {
                    "first": first,
                    "last": last,
                    "pos": pos,
                    "stars": 1,
                    "state": state,
                    "rating_fr": rating_fr,
                    "rating_so": rating_so,
                    "rating_jr": rating_jr,
                    "rating_sr": rating_sr,
                    "development_trait": development_trait,
                }
            )
            class_remaining[team.id] -= 1

    return class_assignments


def preview_roster_cuts(info):
    """Preview roster cuts for the user's team based on projected ratings."""
    players = list(info.team.players.filter(active=True))
    cuts = []

    for pos, config in ROSTER.items():
        pos_players = [p for p in players if p.pos == pos]
        if len(pos_players) <= config["total"]:
            continue
        pos_players.sort(
            key=lambda p: (p.rating_sr, p.rating, p.year),
            reverse=True,
        )
        cuts.extend(pos_players[config["total"] :])

    return cuts


def apply_roster_cuts(info):
    """Cut rosters down to positional limits based on projected ratings."""
    players = list(info.players.filter(active=True))
    cuts = []

    for team in info.teams.all():
        team_players = [p for p in players if p.team_id == team.id]
        for pos, config in ROSTER.items():
            pos_players = [p for p in team_players if p.pos == pos]
            if len(pos_players) <= config["total"]:
                continue
            pos_players.sort(
                key=lambda p: (p.rating_sr, p.rating, p.year),
                reverse=True,
            )
            for player in pos_players[config["total"] :]:
                cuts.append(player.id)

    if cuts:
        Players.objects.filter(id__in=cuts).update(active=False, starter=False)

    _log_position_shortages(info, list(info.teams.all()), "after apply_roster_cuts")


def _log_position_shortages(info, teams, label):
    shortages = []
    for team in teams:
        counts = {
            pos: info.players.filter(active=True, team_id=team.id, pos=pos).count()
            for pos in ROSTER
        }
        for pos, config in ROSTER.items():
            if counts[pos] < config["total"]:
                shortages.append(
                    f"{team.name}:{pos} {counts[pos]}/{config['total']}"
                )
    if shortages:
        print(f"Roster shortages {label}: {', '.join(shortages[:20])}")


def calculate_single_team_rating(players_data):
    """Calculate team ratings from a list of player data"""
    starters = [p for p in players_data if p["starter"]]

    weighted_players = []
    for player in starters:
        pos = player["pos"]
        rating = player["rating"]

        if pos in OFFENSIVE_WEIGHTS:
            weight = OFFENSIVE_WEIGHTS[pos]
        elif pos in DEFENSIVE_WEIGHTS:
            weight = DEFENSIVE_WEIGHTS[pos]
        else:
            weight = 0

        weighted_players.append(
            {
                "pos": pos,
                "rating": rating,
                "weight": weight,
                "weighted_rating": rating * weight,
            }
        )

    offensive_players = [p for p in weighted_players if p["pos"] in OFFENSIVE_WEIGHTS]
    defensive_players = [p for p in weighted_players if p["pos"] in DEFENSIVE_WEIGHTS]

    offensive_rating = 0
    if offensive_players:
        total_weight = sum(p["weight"] for p in offensive_players)
        if total_weight > 0:
            offensive_rating = (
                sum(p["weighted_rating"] for p in offensive_players) / total_weight
            )

    defensive_rating = 0
    if defensive_players:
        total_weight = sum(p["weight"] for p in defensive_players)
        if total_weight > 0:
            defensive_rating = (
                sum(p["weighted_rating"] for p in defensive_players) / total_weight
            )

    offense_variance = random.uniform(*RANDOM_VARIANCE_RANGE)
    defense_variance = random.uniform(*RANDOM_VARIANCE_RANGE)

    offensive_rating += offense_variance
    defensive_rating += defense_variance

    overall_rating = (offensive_rating * OFFENSE_WEIGHT) + (
        defensive_rating * DEFENSE_WEIGHT
    )

    return {
        "offense": round(offensive_rating),
        "defense": round(defensive_rating),
        "overall": round(overall_rating),
    }


def calculate_all_team_ratings(info):
    """Calculate team ratings for all teams in info."""
    teams = info.teams.prefetch_related("players").all()

    for team in teams:
        starters = team.players.filter(starter=True, active=True)
        team_players = [
            {"pos": player.pos, "rating": player.rating, "starter": player.starter}
            for player in starters
        ]
        team_ratings = calculate_single_team_rating(team_players)

        team.offense = team_ratings["offense"]
        team.defense = team_ratings["defense"]
        team.rating = team_ratings["overall"]

    Teams.objects.bulk_update(teams, ["offense", "defense", "rating"])


def set_starters(info):
    # Reset all starters to False in one database operation
    info.players.filter(active=True).update(starter=False)

    players = (
        info.players.filter(active=True, pos__in=ROSTER.keys())
        .order_by("team_id", "pos", "-rating")
        .values_list("id", "team_id", "pos")
    )
    starter_ids = []

    starter_counts = {}
    for player_id, team_id, pos in players.iterator():
        key = (team_id, pos)
        if starter_counts.get(key, 0) >= ROSTER[pos]["starters"]:
            continue
        starter_counts[key] = starter_counts.get(key, 0) + 1
        starter_ids.append(player_id)

    # Bulk update only the players that changed
    if starter_ids:
        Players.objects.filter(id__in=starter_ids).update(starter=True)
