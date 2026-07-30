import { describe, expect, it } from 'vitest';
import { buildTestPlayer } from '../test/fixtures';
import {
  applyProgression,
  projectPlayerProgression,
} from './roster';

describe('player progression projection', () => {
  it('projects active seniors as departing', () => {
    const player = buildTestPlayer({ year: 'sr' });

    expect(projectPlayerProgression(player)).toEqual({
      status: 'departing',
    });
  });

  it.each([
    ['fr', 'so', 'rating_so', 74],
    ['so', 'jr', 'rating_jr', 81],
    ['jr', 'sr', 'rating_sr', 89],
  ] as const)(
    'projects %s players using %s',
    (currentClass, projectedClass, ratingField, projectedRating) => {
      const player = buildTestPlayer({
        year: currentClass,
        [ratingField]: projectedRating,
      });

      expect(projectPlayerProgression(player)).toEqual({
        status: 'returning',
        projectedClass,
        projectedRating,
      });
    },
  );

  it('applies exactly the projected class, rating, and departure outcomes', () => {
    const players = [
      buildTestPlayer({
        id: 1,
        year: 'fr',
        rating: 70,
        rating_so: 76,
      }),
      buildTestPlayer({
        id: 2,
        year: 'so',
        rating: 76,
        rating_jr: 82,
      }),
      buildTestPlayer({
        id: 3,
        year: 'jr',
        rating: 82,
        rating_sr: 88,
      }),
      buildTestPlayer({
        id: 4,
        year: 'sr',
        starter: true,
      }),
      buildTestPlayer({
        id: 5,
        starter: true,
      }),
    ];
    const projections = players.map(projectPlayerProgression);

    applyProgression(players);

    expect(players[0]).toMatchObject({
      year: projections[0]?.status === 'returning'
        ? projections[0].projectedClass
        : undefined,
      rating: projections[0]?.status === 'returning'
        ? projections[0].projectedRating
        : undefined,
    });
    expect(players[1]).toMatchObject({ year: 'jr', rating: 82 });
    expect(players[2]).toMatchObject({ year: 'sr', rating: 88 });
    expect(players.some(player => player.id === 4)).toBe(false);
    expect(players.find(player => player.id === 5)).toMatchObject({
      starter: true,
    });
  });
});
