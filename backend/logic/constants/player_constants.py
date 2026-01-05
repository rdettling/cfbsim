# === Rating System Constants ===

STARS_BASE = {1: 15, 2: 30, 3: 45, 4: 60, 5: 75}

STARS_PRESTIGE = {
    1: {
        1: 70,
        2: 25,
        3: 5,
        4: 0,
        5: 0,
    },
    2: {
        1: 40,
        2: 35,
        3: 15,
        4: 0,
        5: 0,
    },
    3: {
        1: 30,
        2: 40,
        3: 30,
        4: 0,
        5: 0,
    },
    4: {
        1: 0,
        2: 20,
        3: 70,
        4: 10,
        5: 0,
    },
    5: {
        1: 0,
        2: 0,
        3: 67,
        4: 30,
        5: 3,
    },
    6: {
        1: 0,
        2: 0,
        3: 40,
        4: 55,
        5: 5,
    },
    7: {
        1: 0,
        2: 0,
        3: 10,
        4: 75,
        5: 15,
    },
}

BASE_DEVELOPMENT = 4  # Base development all players get per year

RATING_STD_DEV = 6
DEVELOPMENT_STD_DEV = 4
RANDOM_VARIANCE_RANGE = (5, 9)  # applied once to final team rating

ROSTER = {
    "qb": {"starters": 1, "total": 4},
    "rb": {"starters": 2, "total": 5},
    "wr": {"starters": 3, "total": 7},
    "te": {"starters": 1, "total": 5},
    "ol": {"starters": 5, "total": 12},
    "dl": {"starters": 4, "total": 9},
    "lb": {"starters": 3, "total": 7},
    "cb": {"starters": 2, "total": 6},
    "s": {"starters": 2, "total": 5},
    "k": {"starters": 1, "total": 2},
    "p": {"starters": 1, "total": 2},
}

# === Team Rating Calculation Constants ===

# Overall team rating weights
OFFENSE_WEIGHT = 0.60
DEFENSE_WEIGHT = 0.40

# Position weights for offensive rating calculation
OFFENSIVE_WEIGHTS = {
    "qb": 40,
    "rb": 10,
    "wr": 25,
    "te": 5,
    "ol": 20,
}

# Position weights for defensive rating calculation
DEFENSIVE_WEIGHTS = {
    "dl": 35,
    "lb": 20,
    "cb": 30,
    "s": 15,
}
