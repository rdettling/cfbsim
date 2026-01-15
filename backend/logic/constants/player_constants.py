# === Rating System Constants ===

STARS_BASE = {1: 15, 2: 30, 3: 45, 4: 60, 5: 75}

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

RECRUIT_CLASS_YEARS = 4

RECRUIT_STAR_COUNTS = {
    5: 32,
    4: 340,
    3: 2000,
    2: 500,
}
RECRUIT_PRESTIGE_BIAS = 12
RECRUIT_POSITION_NEED_BIAS = 4

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
