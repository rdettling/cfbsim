# === Rating System Constants ===

STARS_BASE = {
    1: 30,
    2: 40,
    3: 50,
    4: 60,
    5: 70
}

STARS_PRESTIGE = {
    1: {
        1: 60,
        2: 30,
        3: 10,
        4: 0,
        5: 0
    },
    2: {
        1: 30,
        2: 50,
        3: 20,
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
        3: 60,
        4: 30,
        5: 10,
    },
    6: {
        1: 0,
        2: 0,
        3: 40,
        4: 50,
        5: 10,
    },
    7: {
        1: 0,
        2: 0,
        3: 10,
        4: 70,
        5: 20,
    },
}

DEVELOPMENT_RANGES = {
    1: (1, 2),    # Slow developer: 1-2 progression per year
    2: (2, 3),    # Below average: 2-3 progression per year  
    3: (2, 4),    # Normal: 2-4 progression per year
    4: (3, 5),    # Above average: 3-5 progression per year
    5: (3, 7)     # Fast developer: 3-7 progression per year
}

BASE_VARIANCE = 10
RANDOM_VARIANCE_RANGE = (-3, 3)  # applied once to final team rating

ROSTER = {
    "qb": 1,
    "rb": 1,
    "wr": 3,
    "te": 1,
    "ol": 5,
    "dl": 4,
    "lb": 3,
    "cb": 2,
    "s": 2,
    "k": 1,
    "p": 1,
} 