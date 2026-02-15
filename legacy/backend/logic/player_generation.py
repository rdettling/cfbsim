import json
import random
from api.models import Players
from .constants.player_constants import (
    BASE_DEVELOPMENT,
    DEVELOPMENT_STD_DEV,
    RATING_STD_DEV,
    STARS_BASE,
)


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


def _build_ratings(base_rating):
    variance = random.gauss(0, RATING_STD_DEV)
    fr_rating = max(1, base_rating + variance)

    development_trait = random.randint(1, 5)
    growth = BASE_DEVELOPMENT + development_trait + random.gauss(0, DEVELOPMENT_STD_DEV)

    so_rating = fr_rating + (growth * 0.6)
    jr_rating = fr_rating + (growth * 0.9)
    sr_rating = fr_rating + (growth * 1.1)

    fr_rating = min(fr_rating, 99)
    so_rating = min(max(so_rating, fr_rating), 99)
    jr_rating = min(max(jr_rating, so_rating), 99)
    sr_rating = min(max(sr_rating, jr_rating), 99)

    return (
        round(fr_rating),
        round(so_rating),
        round(jr_rating),
        round(sr_rating),
        development_trait,
    )


def generate_player_ratings(star_rating):
    """Generate player ratings based on a fixed star rating."""
    fr, so, jr, sr, development_trait = _build_ratings(STARS_BASE[star_rating])
    return fr, so, jr, sr, development_trait


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


def create_player(team, position, year, star_rating, loaded_names):
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
    fr, so, jr, sr, development_trait = generate_player_ratings(star_rating)

    # Get rating for the specified year
    rating_map = {"fr": fr, "so": so, "jr": jr, "sr": sr}
    rating = rating_map.get(year, sr)

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


def create_player_from_recruit(team, recruit, year):
    """Create a player from a recruit dict for the specified year."""
    rating_map = {
        "fr": recruit["rating_fr"],
        "so": recruit["rating_so"],
        "jr": recruit["rating_jr"],
        "sr": recruit["rating_sr"],
    }
    rating = rating_map.get(year, recruit["rating_sr"])

    return Players(
        info=team.info,
        team=team,
        first=recruit["first"],
        last=recruit["last"],
        year=year,
        pos=recruit["pos"],
        rating=rating,
        rating_fr=recruit["rating_fr"],
        rating_so=recruit["rating_so"],
        rating_jr=recruit["rating_jr"],
        rating_sr=recruit["rating_sr"],
        stars=recruit["stars"],
        development_trait=recruit["development_trait"],
        starter=False,
    )
