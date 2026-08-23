import { describe, expect, it } from 'vitest';
import {
  buildTestNamesData,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import { RECRUIT_STAR_COUNTS } from './config';
import {
  generateName,
  generateNationalRatingPool,
  generateProspectPool,
  generateWalkOnRatings,
} from './generation';
import { createSeededRandom } from '../utils/random';
import { FINAL_ROSTER_SIZE, POSITION_ORDER } from '../rosterConfig';

const names = buildTestNamesData({
  black: {
    first: [{ name: 'Alex', weight: 1 }],
    last: [{ name: 'Black', weight: 1 }],
  },
  white: {
    first: [{ name: 'Sam', weight: 1 }],
    last: [{ name: 'White', weight: 1 }],
  },
});

describe('recruiting prospect generation', () => {
  it('selects names from position-weighted profiles', () => {
    const controlled = buildTestNamesData({
      black: {
        first: [{ name: 'BlackFirst', weight: 1 }],
        last: [{ name: 'BlackLast', weight: 1 }],
      },
      white: {
        first: [{ name: 'WhiteFirst', weight: 1 }],
        last: [{ name: 'WhiteLast', weight: 1 }],
      },
    });
    controlled.positionWeights.qb = { black: 100, white: 0 };
    controlled.positionWeights.cb = { black: 0, white: 100 };

    expect(generateName('qb', controlled, createSeededRandom(1))).toEqual({
      first: 'BlackFirst',
      last: 'BlackLast',
    });
    expect(generateName('cb', controlled, createSeededRandom(1))).toEqual({
      first: 'WhiteFirst',
      last: 'WhiteLast',
    });
  });

  it('is seeded, complete, publicly ranked, and internally valid', () => {
    const teams = [
      buildTestTeam({ id: 1, state: 'TS', prestige: 4, ranking: 1 }),
      buildTestTeam({ id: 2, state: 'OS', prestige: 2, ranking: 2 }),
    ];
    const input = {
      teams,
      returningPlayers: [buildTestPlayer()],
      names,
      states: { TS: 2, OS: 1 },
      year: 2026,
      seed: 44,
    };
    const first = generateProspectPool(input);
    const second = generateProspectPool(input);

    expect(first).toEqual(second);
    expect(first[0]).not.toHaveProperty('developmentTrait');
    expect(generateProspectPool({ ...input, seed: 45 })[0]).not.toEqual(first[0]);
    expect(generateProspectPool({ ...input, year: 2027 })[0]).not.toEqual(first[0]);
    expect(first).toHaveLength(
      Object.values(RECRUIT_STAR_COUNTS).reduce((sum, count) => sum + count, 0),
    );
    Object.entries(RECRUIT_STAR_COUNTS).forEach(([stars, count]) => {
      expect(first.filter(prospect => prospect.stars === Number(stars))).toHaveLength(count);
    });
    expect(first.map(prospect => prospect.nationalRank)).toEqual(
      Array.from({ length: first.length }, (_, index) => index + 1),
    );
    expect(
      first
        .slice(0, RECRUIT_STAR_COUNTS[5])
        .every(prospect => prospect.stars === 5),
    ).toBe(true);
    expect(
      first
        .slice(
          RECRUIT_STAR_COUNTS[5],
          RECRUIT_STAR_COUNTS[5] + RECRUIT_STAR_COUNTS[4],
        )
        .every(prospect => prospect.stars === 4),
    ).toBe(true);
    first.forEach(prospect => {
      expect(prospect.publicRatingMax - prospect.publicRatingMin).toBe(10);
      expect(prospect.publicRatingMin).toBeGreaterThanOrEqual(25);
      expect(prospect.publicRatingMax).toBeLessThanOrEqual(99);
      expect(prospect.ratingFr).toBeGreaterThanOrEqual(prospect.publicRatingMin);
      expect(prospect.ratingFr).toBeLessThanOrEqual(prospect.publicRatingMax);
      expect(prospect.ratingSo).toBeGreaterThanOrEqual(prospect.ratingFr);
      expect(prospect.ratingJr).toBeGreaterThanOrEqual(prospect.ratingSo);
      expect(prospect.ratingSr).toBeGreaterThanOrEqual(prospect.ratingJr);
      expect(Object.values(prospect.preferenceWeights).reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(Math.min(...Object.values(prospect.preferenceWeights))).toBeGreaterThanOrEqual(10);
      expect(prospect.interest).toHaveLength(2);
    });
  });

  it(
    'generates the full national pool at realistic scale without roster rescans',
    () => {
      const teams = Array.from({ length: 130 }, (_, index) =>
        buildTestTeam({
          id: index + 1,
          name: `Team ${index + 1}`,
          abbreviation: `T${index + 1}`,
          prestige: (index % 7) + 1,
          ranking: index + 1,
          state: index % 2 ? 'TS' : 'OS',
        }),
      );
      const returningPlayers = teams.flatMap(team =>
        Array.from({ length: FINAL_ROSTER_SIZE }, (_, index) =>
          buildTestPlayer({
            id: (team.id - 1) * FINAL_ROSTER_SIZE + index + 1,
            teamId: team.id,
            pos: POSITION_ORDER[index % POSITION_ORDER.length],
            rating: 50 + (index % 40),
          }),
        ),
      );
      const input = {
        teams,
        returningPlayers,
        names,
        states: { TS: 2, OS: 1 },
        year: 2026,
        seed: 44,
      };
      const teamsBefore = structuredClone(teams);
      const playersBefore = structuredClone(returningPlayers);
      const started = performance.now();

      const pool = generateProspectPool(input);

      expect(performance.now() - started).toBeLessThan(5000);
      expect(pool).toHaveLength(
        Object.values(RECRUIT_STAR_COUNTS).reduce(
          (sum, count) => sum + count,
          0,
        ),
      );
      expect(pool[0].interest).toHaveLength(10);
      expect(teams).toEqual(teamsBefore);
      expect(returningPlayers).toEqual(playersBefore);
    },
    10_000,
  );

  it('generates each comparison pool exactly and deterministically', () => {
    const input = {
      teams: [buildTestTeam()],
      returningPlayers: [buildTestPlayer()],
      names,
      states: { TS: 1 },
      year: 2026,
      seed: 71,
    };
    for (const [threeStars, twoStars] of [
      [2700, 300],
      [2800, 200],
      [2900, 100],
    ]) {
      const starCounts = {
        ...RECRUIT_STAR_COUNTS,
        3: threeStars,
        2: twoStars,
      };
      const first = generateProspectPool({ ...input, starCounts });
      expect(first).toEqual(generateProspectPool({ ...input, starCounts }));
      expect(first).toHaveLength(3372);
      expect(first.filter(prospect => prospect.stars === 3)).toHaveLength(
        threeStars,
      );
      expect(first.filter(prospect => prospect.stars === 2)).toHaveLength(
        twoStars,
      );
    }
  });

  it('uses the national continuum, variable development, and overlapping scouting labels', () => {
    const poolCount = 4;
    const pools = Array.from({ length: poolCount }, (_, index) =>
      generateNationalRatingPool(createSeededRandom(20260823 + index)),
    );
    const players = pools.flat();
    const activeRatings = players.flatMap(player => [
      player.fr,
      player.so,
      player.jr,
      player.sr,
    ]);
    const average = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(Math.min(...activeRatings)).toBe(25);
    expect(Math.max(...activeRatings)).toBeLessThanOrEqual(99);

    const freshmanByStars = Object.fromEntries(
      [2, 3, 4, 5].map(stars => [
        stars,
        players
          .filter(player => player.stars === stars)
          .map(player => player.fr),
      ]),
    ) as Record<number, number[]>;
    expect(average(freshmanByStars[2])).toBeGreaterThanOrEqual(27);
    expect(average(freshmanByStars[2])).toBeLessThanOrEqual(33);
    expect(average(freshmanByStars[3])).toBeGreaterThanOrEqual(47);
    expect(average(freshmanByStars[3])).toBeLessThanOrEqual(53);
    expect(average(freshmanByStars[4])).toBeGreaterThanOrEqual(64);
    expect(average(freshmanByStars[4])).toBeLessThanOrEqual(70);
    expect(average(freshmanByStars[5])).toBeGreaterThanOrEqual(76);
    expect(average(freshmanByStars[5])).toBeLessThanOrEqual(82);
    expect(Math.max(...freshmanByStars[3])).toBeGreaterThan(
      Math.min(...freshmanByStars[4]),
    );
    expect(Math.max(...freshmanByStars[4])).toBeGreaterThan(
      Math.min(...freshmanByStars[5]),
    );

    const seniorsByStars = Object.fromEntries(
      [2, 3, 4, 5].map(stars => [
        stars,
        players
          .filter(player => player.stars === stars)
          .map(player => player.sr),
      ]),
    ) as Record<number, number[]>;
    expect(average(seniorsByStars[5])).toBeGreaterThan(
      average(seniorsByStars[4]),
    );
    expect(average(seniorsByStars[4])).toBeGreaterThan(
      average(seniorsByStars[3]),
    );
    expect(average(seniorsByStars[3])).toBeGreaterThan(
      average(seniorsByStars[2]),
    );
    expect(Math.max(...seniorsByStars[3])).toBeGreaterThan(
      Math.min(...seniorsByStars[5]),
    );

    players.forEach(player => {
      expect(player.so).toBeGreaterThanOrEqual(player.fr);
      expect(player.jr).toBeGreaterThanOrEqual(player.so);
      expect(player.sr).toBeGreaterThanOrEqual(player.jr);
    });
    const growth = players.map(player => player.sr - player.fr);
    expect(average(growth)).toBeGreaterThan(8);
    const transitionGrowth = players.reduce(
      (totals, player) => ({
        so: totals.so + player.so - player.fr,
        jr: totals.jr + player.jr - player.so,
        sr: totals.sr + player.sr - player.jr,
      }),
      { so: 0, jr: 0, sr: 0 },
    );
    const totalGrowth = Object.values(transitionGrowth).reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(transitionGrowth.so / totalGrowth).toBeCloseTo(0.5, 2);
    expect(transitionGrowth.jr / totalGrowth).toBeCloseTo(0.35, 2);
    expect(transitionGrowth.sr / totalGrowth).toBeCloseTo(0.15, 2);
    expect(players.some(player =>
      player.sr > player.fr &&
      player.so - player.fr !== Math.round(0.5 * (player.sr - player.fr)),
    )).toBe(true);

    const walkOns = Array.from({ length: 1000 }, (_, index) =>
      generateWalkOnRatings(createSeededRandom(77).fork(index)),
    );
    expect(average(walkOns.map(player => player.fr))).toBeGreaterThan(27);
    expect(average(walkOns.map(player => player.fr))).toBeLessThan(32);
    expect(average(walkOns.map(player => player.sr))).toBeLessThan(
      average(seniorsByStars[2]),
    );
    expect(
      Math.min(...walkOns.map(player => player.fr)),
    ).toBeGreaterThanOrEqual(25);
  });
});
