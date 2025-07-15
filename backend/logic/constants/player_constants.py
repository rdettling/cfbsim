# === Rating System Constants ===

STARS_BASE = {
    1: 15,
    2: 30,
    3: 50,
    4: 68,
    5: 80
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
        3: 67,
        4: 30,
        5: 3,
    },
    6: {
        1: 0,
        2: 0,
        3: 40,
        4: 53,
        5: 7,
    },
    7: {
        1: 0,
        2: 0,
        3: 15,
        4: 70,
        5: 15,
    },
}

DEVELOPMENT_AVERAGES = {
    1: 1,
    2: 2,
    3: 3,   
    4: 4,    
    5: 5     
}

RATING_STD_DEV = 12  
DEVELOPMENT_STD_DEV = 5
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