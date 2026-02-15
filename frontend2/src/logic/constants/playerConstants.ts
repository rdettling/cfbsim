export const STARS_BASE: Record<number, number> = { 1: 15, 2: 30, 3: 45, 4: 60, 5: 75 };

export const BASE_DEVELOPMENT = 4;
export const RATING_STD_DEV = 6;
export const DEVELOPMENT_STD_DEV = 4;
export const RANDOM_VARIANCE_RANGE: [number, number] = [5, 9];

export const ROSTER: Record<string, { starters: number; total: number }> = {
  qb: { starters: 1, total: 4 },
  rb: { starters: 2, total: 5 },
  wr: { starters: 3, total: 7 },
  te: { starters: 1, total: 5 },
  ol: { starters: 5, total: 12 },
  dl: { starters: 4, total: 9 },
  lb: { starters: 3, total: 7 },
  cb: { starters: 2, total: 6 },
  s: { starters: 2, total: 5 },
  k: { starters: 1, total: 2 },
  p: { starters: 1, total: 2 },
};

export const RECRUIT_CLASS_YEARS = 4;
export const RECRUIT_STAR_COUNTS: Record<number, number> = {
  5: 32,
  4: 340,
  3: 2000,
  2: 500,
};
export const RECRUIT_PRESTIGE_BIAS = 12;
export const RECRUIT_POSITION_NEED_BIAS = 4;

export const OFFENSE_WEIGHT = 0.6;
export const DEFENSE_WEIGHT = 0.4;

export const OFFENSIVE_WEIGHTS: Record<string, number> = {
  qb: 40,
  rb: 10,
  wr: 25,
  te: 5,
  ol: 20,
};

export const DEFENSIVE_WEIGHTS: Record<string, number> = {
  dl: 35,
  lb: 20,
  cb: 30,
  s: 15,
};
