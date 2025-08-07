import random
from collections import Counter
from api.models import *
from .constants.player_constants import *
from .player_generation import load_names, create_player


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
    players = info.players.filter(active=True)
    progressed_players = []
    to_update = []

    for player in players.exclude(year="sr"):
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

        print(
            f"DEBUG: {player.first} {player.last} - old: {old_rating}, new: {player.rating}, change: {player.change}"
        )

        to_update.append(player)
        progressed_players.append(player)

    Players.objects.bulk_update(to_update, ["rating"])
    return [p for p in progressed_players if p.team == info.team and p.year != "sr"]


def progress_years(info):
    """
    Progress players to the next year (fr->so, so->jr, jr->sr).
    Used for recruiting summary stage when transitioning seasons.

    Args:
        info: Info object

    Returns:
        List of progressed players
    """
    players = info.players.filter(active=True)
    to_update = []

    for player in players.exclude(year="sr"):
        if player.year == "fr":
            player.year = "so"
        elif player.year == "so":
            player.year = "jr"
        elif player.year == "jr":
            player.year = "sr"

        to_update.append(player)

    Players.objects.bulk_update(to_update, ["year"])
    return [p for p in to_update if p.team == info.team and p.year != "sr"]


def fill_roster(team, loaded_names, players_to_create):
    """Fill missing players for an existing team"""
    player_counts = Counter(
        team.players.filter(active=True).values_list("pos", flat=True)
    )

    for position, count in ROSTER.items():
        current_count = player_counts.get(position, 0)
        needed = max(0, (2 * count + 1) - current_count)

        for _ in range(needed):
            player = create_player(team, position, "fr", loaded_names)
            players_to_create.append(player)


def init_roster(team, loaded_names, players_to_create):
    """Initialize a complete roster for a new team"""
    years = ["fr", "so", "jr", "sr"]

    for position, count in ROSTER.items():
        for i in range(2 * count + 1):
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


def set_starters(info):
    """Set starters for all teams - optimized version"""
    # Reset all starters to False in one database operation
    info.players.filter(active=True).update(starter=False)
    
    # Process each team individually to reduce memory usage
    teams = info.teams.all()
    players_to_update = []
    
    for team in teams:
        # Get players for this team only, grouped by position
        team_players = team.players.filter(active=True).select_related("team")
        
        # Group by position for this team
        players_by_position = {}
        for player in team_players:
            if player.pos not in players_by_position:
                players_by_position[player.pos] = []
            players_by_position[player.pos].append(player)
        
        # Set starters for each position on this team
        for position, players_in_position in players_by_position.items():
            if position in ROSTER:
                # Sort by rating (highest first) and take top N players
                sorted_players = sorted(players_in_position, key=lambda x: x.rating, reverse=True)
                starter_count = ROSTER[position]
                
                # Mark top players as starters
                for player in sorted_players[:starter_count]:
                    player.starter = True
                    players_to_update.append(player)
    
    # Bulk update only the players that changed
    if players_to_update:
        Players.objects.bulk_update(players_to_update, ["starter"])
