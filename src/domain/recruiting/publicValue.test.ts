import { describe, expect, it } from 'vitest';
import { buildPublicRecruitingValues } from './publicValue';

describe('public recruiting value', () => {
  it('uses national rank as the only within-star quality signal', () => {
    const values = buildPublicRecruitingValues([
      { id: 3, nationalRank: 30, stars: 4 },
      { id: 1, nationalRank: 10, stars: 4 },
      { id: 2, nationalRank: 20, stars: 4 },
    ]);

    expect(values.get(1)).toBe(82);
    expect(values.get(2)).toBe(77);
    expect(values.get(3)).toBe(72);
  });

  it('is deterministic across input order and handles a single star peer', () => {
    const prospects = [
      { id: 4, nationalRank: 4, stars: 5 },
      { id: 2, nationalRank: 2, stars: 5 },
      { id: 8, nationalRank: 80, stars: 3 },
    ];

    expect(
      [...buildPublicRecruitingValues(prospects).entries()].sort(),
    ).toEqual(
      [...buildPublicRecruitingValues([...prospects].reverse()).entries()].sort(),
    );
    expect(buildPublicRecruitingValues(prospects).get(8)).toBe(64);
  });
});
