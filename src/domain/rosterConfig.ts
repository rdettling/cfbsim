export const ROSTER: Record<
  string,
  { starters: number; total: number }
> = {
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

export const POSITION_ORDER = Object.keys(ROSTER);
