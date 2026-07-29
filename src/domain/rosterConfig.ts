export const ROSTER: Record<
  string,
  { starters: number; total: number }
> = {
  qb: { starters: 1, total: 5 },
  rb: { starters: 2, total: 6 },
  wr: { starters: 3, total: 9 },
  te: { starters: 1, total: 6 },
  ol: { starters: 5, total: 15 },
  dl: { starters: 4, total: 11 },
  lb: { starters: 3, total: 9 },
  cb: { starters: 2, total: 8 },
  s: { starters: 2, total: 7 },
  k: { starters: 1, total: 2 },
  p: { starters: 1, total: 2 },
};

export const POSITION_ORDER = Object.keys(ROSTER);
export const FINAL_ROSTER_SIZE = Object.values(ROSTER).reduce(
  (sum, position) => sum + position.total,
  0,
);
export const ROSTER_OVERSIGN_ALLOWANCE = 4;
export const MAX_ROSTER_SIZE =
  FINAL_ROSTER_SIZE + ROSTER_OVERSIGN_ALLOWANCE;
