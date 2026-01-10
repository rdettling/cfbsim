import random
import time
from collections import Counter
from api.models import *
from django.db.models import Case, When, Value, F
from .constants.player_constants import *
from .player_generation import load_names, create_player
from logic.util import time_section


def create_freshmen(info):
    """Create freshmen for all teams"""
    players_to_create = []
    loaded_names = load_names()

    for team in info.teams.all():
        if team.rating:
            fill_roster(team, loaded_names, players_to_create)
        else:
            init_roster(team, loaded_names, players_to_create)

    Players.objects.bulk_create(players_to_create)
    return players_to_create


def remove_seniors(info):
    """Mark seniors as inactive instead of deleting them"""
    players = info.players.all()
    graduating_seniors = players.filter(year="sr", active=True)
    graduating_seniors_list = list(graduating_seniors)

    # Set seniors to inactive and remove starter status
    graduating_seniors.update(active=False, starter=False)

    print(f"Marked {len(graduating_seniors_list)} seniors as inactive")


def progress_ratings(info):
    """
    Update player ratings to next year's rating without changing years.
    Used for roster progression page to show rating improvements.

    Args:
        info: Info object

    Returns:
        List of progressed players with their change values
    """
    overall_start = time.time()
    players_start = time.time()
    players = info.players.filter(active=True)
    time_section(players_start, "    • progress_ratings: Active players query")
    exclude_start = time.time()
    progressed_team_players = []
    to_update = []

    eligible_players = list(players.exclude(year="sr"))
    time_section(exclude_start, "    • progress_ratings: Eligible players loaded")

    loop_start = time.time()
    for player in eligible_players:
        old_rating = player.rating

        if player.year == "fr":
            player.rating = player.rating_so
            player.change = player.rating - player.rating_fr
        elif player.year == "so":
            player.rating = player.rating_jr
            player.change = player.rating - player.rating_so
        elif player.year == "jr":
            player.rating = player.rating_sr
            player.change = player.rating - player.rating_jr
        else:
            player.change = 0

        to_update.append(player)
        if player.team_id == info.team_id:
            progressed_team_players.append(player)
    time_section(loop_start, "    • progress_ratings: Progress loop")

    update_start = time.time()
    Players.objects.bulk_update(to_update, ["rating"])
    time_section(update_start, "    • progress_ratings: Bulk update")
    time_section(overall_start, "  • Progress ratings total")
    return progressed_team_players


def progress_years(info):
    """
    Progress players to the next year (fr->so, so->jr, jr->sr).
    Used for recruiting summary stage when transitioning seasons.

    Args:
        info: Info object

    Returns:
        List of progressed players
    """
    players = info.players.filter(active=True).exclude(year="sr")
    players.update(
        year=Case(
            When(year="fr", then=Value("so")),
            When(year="so", then=Value("jr")),
            When(year="jr", then=Value("sr")),
            default=F("year"),
        )
    )
    return list(info.team.players.filter(active=True).exclude(year="sr"))


def fill_roster(team, loaded_names, players_to_create):
    """Fill missing players for an existing team"""
    player_counts = Counter(
        team.players.filter(active=True).values_list("pos", flat=True)
    )

    for position, position_config in ROSTER.items():
        current_count = player_counts.get(position, 0)
        needed = max(0, position_config["total"] - current_count)

        for _ in range(needed):
            player = create_player(team, position, "fr", loaded_names)
            players_to_create.append(player)


def init_roster(team, loaded_names, players_to_create):
    """Initialize a complete roster for a new team"""
    years = ["fr", "so", "jr", "sr"]

    for position, position_config in ROSTER.items():
        for i in range(position_config["total"]):
            year = random.choice(years)
            player = create_player(team, position, year, loaded_names)
            players_to_create.append(player)


def calculate_team_ratings_from_players(players_data):
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


def calculate_team_ratings(info):
    """Calculate team ratings for all teams"""
    overall_start = time.time()
    teams = info.teams.prefetch_related("players").all()

    for team in teams:
        starters = team.players.filter(starter=True, active=True)
        players_data = [
            {"pos": player.pos, "rating": player.rating, "starter": player.starter}
            for player in starters
        ]
        team_ratings = calculate_team_ratings_from_players(players_data)

        team.offense = team_ratings["offense"]
        team.defense = team_ratings["defense"]
        team.rating = team_ratings["overall"]

    Teams.objects.bulk_update(teams, ["offense", "defense", "rating"])
    time_section(overall_start, "  • calculate_team_ratings total")


def set_starters(info):
    """Set starters for all teams - optimized version"""
    overall_start = time.time()
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
    time_section(overall_start, "  • set_starters total")
