import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import { RECRUIT_STAR_COUNTS, STAR_RATING_TARGETS } from './config';
import {
  generatePlayerRatings,
  generateProspectPool,
} from './generation';
import { createSeededRandom } from './random';
import { FINAL_ROSTER_SIZE, POSITION_ORDER } from '../rosterConfig';

const names = {
  black: {
    first: [{ name: 'Alex', weight: 1 }],
    last: [{ name: 'Black', weight: 1 }],
  },
  white: {
    first: [{ name: 'Sam', weight: 1 }],
    last: [{ name: 'White', weight: 1 }],
  },
};

describe('recruiting prospect generation', () => {
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
    expect(generateProspectPool({ ...input, seed: 45 })[0]).not.toEqual(first[0]);
    expect(generateProspectPool({ ...input, year: 2027 })[0]).not.toEqual(first[0]);
    expect(first).toHaveLength(
      Object.values(RECRUIT_STAR_COUNTS).reduce((sum, count) => sum + count, 0),
    );
    Object.entries(RECRUIT_STAR_COUNTS).forEach(([stars, count]) => {
      expect(first.filter(prospect => prospect.stars === Number(stars))).toHaveLength(count);
    });
    first.forEach(prospect => {
      expect(prospect.publicRatingMax - prospect.publicRatingMin).toBe(10);
      expect(prospect.publicRatingMin).toBeGreaterThanOrEqual(30);
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
    expect(first.map(prospect => prospect.nationalRank).sort((a, b) => a - b)).toEqual(
      Array.from({ length: first.length }, (_, index) => index + 1),
    );
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

  it('matches the retuned mean curve with moderate adjacent overlap', () => {
    const samples = 5000;
    const summaries = [1, 2, 3, 4, 5].map(stars => {
      const ratings = Array.from({ length: samples }, (_, index) =>
        generatePlayerRatings(
          stars,
          createSeededRandom(99).fork(`${stars}:${index}`),
        ),
      );
      return {
        stars,
        freshman:
          ratings.reduce((sum, rating) => sum + rating.fr, 0) / samples,
        senior: ratings.reduce((sum, rating) => sum + rating.sr, 0) / samples,
        freshmanMin: Math.min(...ratings.map(rating => rating.fr)),
        freshmanMax: Math.max(...ratings.map(rating => rating.fr)),
      };
    });
    summaries.forEach(summary => {
      const target = STAR_RATING_TARGETS[summary.stars];
      expect(Math.abs(summary.freshman - target.freshman)).toBeLessThan(1.2);
      expect(Math.abs(summary.senior - target.senior)).toBeLessThan(1.2);
    });
    for (let index = 0; index < summaries.length - 1; index += 1) {
      expect(summaries[index].freshmanMax).toBeGreaterThan(
        summaries[index + 1].freshmanMin,
      );
    }
  });
});
