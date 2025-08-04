import json
import random
from api.models import *
from .constants.player_constants import *


def load_names():
    """Load and process name data from JSON file"""
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
    # Ensure sophomore rating is at least as high as freshman rating
    so_rating = max(so_rating, fr_rating)

    # Junior year progression
    jr_progression = random.gauss(base_progression, DEVELOPMENT_STD_DEV)
    jr_rating = so_rating + jr_progression
    # Ensure junior rating is at least as high as sophomore rating
    jr_rating = max(jr_rating, so_rating)

    # Senior year progression
    sr_progression = random.gauss(base_progression, DEVELOPMENT_STD_DEV)
    sr_rating = jr_rating + sr_progression
    # Ensure senior rating is at least as high as junior rating
    sr_rating = max(sr_rating, jr_rating)

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


def generateName(position, names):
    """Generate a player name based on position and race distribution"""
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
