import json
import random
from api.models import *
from collections import Counter
from .constants.player_constants import *


def load_names():
    with open("data/names.json") as f:
        names_data = json.load(f)

    processed_names = {
        "black": {"first": [], "last": []},
        "white": {"first": [], "last": []},
    }

    for race in ["black", "white"]:
        for name_type in ["first", "last"]:
            for name_info in names_data[race][name_type]:
                processed_names[race][name_type].extend(
                    [name_info["name"]] * name_info["weight"]
                )

    return processed_names


def generate_player_ratings(prestige):
    """
    Generate player ratings for all years using the new star-based system.
    Returns: (fr, so, jr, sr) ratings
    """
    # Determine player's star rating based on prestige tier
    star_distribution = STARS_PRESTIGE[prestige]
    star_rating = random.choices(
        list(star_distribution.keys()), weights=list(star_distribution.values())
    )[0]

    # Get base rating for this star level
    base_rating = STARS_BASE[star_rating]

    # Add variance using normal distribution with standard deviation
    variance = random.gauss(0, RATING_STD_DEV)
    fr_rating = base_rating + variance

    # Ensure freshman rating doesn't go below 1
    fr_rating = max(1, fr_rating)

    # Randomly assign development trait (1-5, equal chance)
    development_trait = random.randint(1, 5)

    # Calculate progression for each year independently using normal distribution
    so_rating = fr_rating
    jr_rating = fr_rating
    sr_rating = fr_rating

    # Get base progression for this development trait
    base_progression = BASE_DEVELOPMENT + development_trait

    # Sophomore year progression
    so_progression = random.gauss(base_progression, DEVELOPMENT_STD_DEV)
    so_rating += so_progression

    # Junior year progression
    jr_progression = random.gauss(base_progression, DEVELOPMENT_STD_DEV)
    jr_rating = so_rating + jr_progression

    # Senior year progression
    sr_progression = random.gauss(base_progression, DEVELOPMENT_STD_DEV)
    sr_rating = jr_rating + sr_progression

    # Cap all ratings at 99
    fr_rating = min(fr_rating, 99)
    so_rating = min(so_rating, 99)
    jr_rating = min(jr_rating, 99)
    sr_rating = min(sr_rating, 99)

    return (
        round(fr_rating),
        round(so_rating),
        round(jr_rating),
        round(sr_rating),
        star_rating,
        development_trait,
    )


def remove_seniors(info):
    players = info.players.all()
    team = info.team
    leaving_seniors = players.filter(year="sr", team=team)
    leaving_seniors_list = list(leaving_seniors)
    leaving_seniors.delete()
    print(f"Removed seniors: {len(leaving_seniors_list)} players")


def progress_players(info, first_time=False):
    players = info.players.all()
    to_update = []

    if first_time:
        for player in players.exclude(year="sr"):
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

        Players.objects.bulk_update(to_update, ["rating", "year"])

    return players.filter(team=info.team).exclude(year="sr")


def generateName(position, names):
    positions = {
        "qb": 15,
        "rb": 70,
        "wr": 70,
        "te": 30,
        "ol": 20,
        "dl": 70,
        "lb": 50,
        "cb": 90,
        "s": 70,
        "k": 0,
        "p": 0,
    }

    if random.random() <= positions[position] / 100:
        race = "black"
    else:
        race = "white"

    first = random.choice(names[race]["first"])
    last = random.choice(names[race]["last"])

    return (first, last)


def calculate_team_ratings_from_players(players_data):
    """
    Calculate team ratings from a list of player data.
    This is a pure function that can be used for testing without Django models.

    Args:
        players_data: List of dicts with 'pos', 'rating', 'starter' keys

    Returns:
        Dict with 'offense', 'defense', 'overall' ratings
    """
    # Filter to only starters
    starters = [p for p in players_data if p["starter"]]

    # Calculate weighted ratings for each player
    weighted_players = []
    for player in starters:
        pos = player["pos"]
        rating = player["rating"]

        # Get position weight
        if pos in OFFENSIVE_WEIGHTS:
            weight = OFFENSIVE_WEIGHTS[pos]
        elif pos in DEFENSIVE_WEIGHTS:
            weight = DEFENSIVE_WEIGHTS[pos]
        else:
            weight = 0  # Kickers, punters, etc.

        weighted_players.append(
            {
                "pos": pos,
                "rating": rating,
                "weight": weight,
                "weighted_rating": rating * weight,
            }
        )

    # Calculate offensive and defensive totals
    offensive_players = [p for p in weighted_players if p["pos"] in OFFENSIVE_WEIGHTS]
    defensive_players = [p for p in weighted_players if p["pos"] in DEFENSIVE_WEIGHTS]

    # Calculate weighted averages
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

    # Add random variance
    offense_variance = random.uniform(*RANDOM_VARIANCE_RANGE)
    defense_variance = random.uniform(*RANDOM_VARIANCE_RANGE)

    offensive_rating += offense_variance
    defensive_rating += defense_variance

    # Calculate overall rating
    overall_rating = (offensive_rating * OFFENSE_WEIGHT) + (
        defensive_rating * DEFENSE_WEIGHT
    )

    return {
        "offense": round(offensive_rating),
        "defense": round(defensive_rating),
        "overall": round(overall_rating),
    }


def calculate_team_ratings(info):
    """
    Calculate team ratings for all teams in the info object using Django models.
    Uses the pure function calculate_team_ratings_from_players to avoid code duplication.
    """
    teams = info.teams.prefetch_related("players").all()

    for team in teams:
        # Get all starter players for this team
        starters = team.players.filter(starter=True)

        # Convert to the format expected by calculate_team_ratings_from_players
        players_data = [
            {"pos": player.pos, "rating": player.rating, "starter": player.starter}
            for player in starters
        ]

        # Calculate team ratings using the pure function
        team_ratings = calculate_team_ratings_from_players(players_data)

        # Update the team model
        team.offense = team_ratings["offense"]
        team.defense = team_ratings["defense"]
        team.rating = team_ratings["overall"]

    # Bulk update all teams
    Teams.objects.bulk_update(teams, ["offense", "defense", "rating"])


def set_starters(info):
    """
    Set starters for all teams in the database.
    """
    players = info.players.select_related("team").all()

    # Reset all starters
    for player in players:
        player.starter = False

    # Group players by team and position
    players_by_team_and_position = {
        team: {position: [] for position in ROSTER} for team in info.teams.all()
    }

    for player in players:
        players_by_team_and_position[player.team][player.pos].append(player)

    # Set starters for each team and position
    for team_players in players_by_team_and_position.values():
        for position, players_in_position in team_players.items():
            players_in_position.sort(key=lambda x: x.rating, reverse=True)

            for player in players_in_position[: ROSTER[position]]:
                player.starter = True

    Players.objects.bulk_update(players, ["starter"])


def create_player(team, position, year, loaded_names):
    """
    Create a single player for a team.

    Args:
        team: Team object
        position: Player position
        year: Player year ('fr', 'so', 'jr', 'sr')
        loaded_names: Loaded name data

    Returns:
        Players object (not saved to database)
    """
    first, last = generateName(position, loaded_names)
    fr, so, jr, sr, star_rating, development_trait = generate_player_ratings(
        team.prestige
    )

    # Get rating for the specified year
    if year == "fr":
        rating = fr
    elif year == "so":
        rating = so
    elif year == "jr":
        rating = jr
    elif year == "sr":
        rating = sr

    return Players(
        info=team.info,
        team=team,
        first=first,
        last=last,
        year=year,
        pos=position,
        rating=rating,
        rating_fr=fr,
        rating_so=so,
        rating_jr=jr,
        rating_sr=sr,
        stars=star_rating,
        development_trait=development_trait,
        starter=False,
    )


def fill_roster(team, loaded_names, players_to_create):
    """
    Fill missing players for an existing team.
    Only adds players that are needed to reach the full roster size.
    All new players are freshmen.
    """
    player_counts = Counter(team.players.values_list("pos", flat=True))

    for position, count in ROSTER.items():
        current_count = player_counts.get(position, 0)
        needed = max(0, (2 * count + 1) - current_count)

        for _ in range(needed):
            player = create_player(team, position, "fr", loaded_names)
            players_to_create.append(player)


def init_roster(team, loaded_names, players_to_create):
    """
    Initialize a complete roster for a new team.
    Creates full roster with random year distribution.
    Starters are set separately by set_starters().
    """
    years = ["fr", "so", "jr", "sr"]

    # Create full roster
    for position, count in ROSTER.items():
        for i in range(2 * count + 1):
            year = random.choice(years)
            player = create_player(team, position, year, loaded_names)
            players_to_create.append(player)


# def generate_recruit(
#     stars, info, overall_rank, state_ranks, position_ranks, states_list, positions_list
# ):
#     position = random.choice(positions_list)
#     first, last = generateName(position)
#     state = random.choice(states_list)

#     # Get the current state rank for the selected state and update it
#     current_state_rank = state_ranks.get(state, 1)
#     state_ranks[state] = current_state_rank + 1

#     # Get the current position rank for the selected position and update it
#     current_position_rank = position_ranks.get(position, 1)
#     position_ranks[position] = current_position_rank + 1

#     if stars == 5:
#         min_prestige = 90
#     elif stars == 4:
#         min_prestige = 80
#     else:
#         min_prestige = 0

#     return Recruits(
#         info=info,
#         first=first,
#         last=last,
#         pos=position,
#         stars=stars,
#         state=state,
#         overall_rank=overall_rank,
#         min_prestige=min_prestige,
#         state_rank=current_state_rank,
#         position_rank=current_position_rank,
#     )


# def generate_recruits(info, recruits_to_create):
#     with open("start/static/states.json", "r") as file:
#         STATE_FREQUENCIES = json.load(file)

#     states_list = [
#         state for state, freq in STATE_FREQUENCIES.items() for _ in range(freq)
#     ]

#     positions_list = [pos for pos, freq in ROSTER.items() for _ in range(freq)]

#     stars_distribution = {5: 30, 4: 300, 3: 1000}

#     # Overall rank starts at 1
#     current_overall_rank = 1

#     # Dictionaries to keep track of state ranks and position ranks
#     state_ranks = {}
#     position_ranks = {}

#     for stars, count in stars_distribution.items():
#         for _ in range(count):
#             recruits_to_create.append(
#                 generate_recruit(
#                     stars,
#                     info,
#                     current_overall_rank,
#                     state_ranks,
#                     position_ranks,
#                     states_list,
#                     positions_list,
#                 )
#             )
#             current_overall_rank += 1


# def aiRecruitOffers(info):
#     # Get all AI teams related to this info
#     ai_teams = info.teams.all().exclude(pk=info.team.pk)

#     # Get all recruits related to this info
#     recruits = info.recruits.all().order_by("overall_rank")

#     offers_to_create = []

#     for team in ai_teams:
#         # Here, we'll find the top recruit (by overall_rank) without an offer.
#         recruit_without_offer = (
#             recruits.annotate(offer_count=Count("offers")).filter(offer_count=0).first()
#         )

#         if recruit_without_offer:
#             offers_to_create.append(
#                 Offers(
#                     info=info,
#                     recruit=recruit_without_offer,
#                     team=team,
#                 )
#             )

#             # Remove this recruit from the recruits QuerySet to avoid offering him again
#             recruits = recruits.exclude(pk=recruit_without_offer.pk)

#     # Bulk create all the offers
#     Offers.objects.bulk_create(offers_to_create)
