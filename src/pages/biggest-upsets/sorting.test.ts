import { describe, expect, it } from 'vitest';
import type { BiggestUpsetGame } from '../../domain/league/loaders/biggestUpsets';
import { sortBiggestUpsets } from './sorting';

const upset = (
  gameId: number,
  week: number,
  winnerWinProbability: number,
): BiggestUpsetGame => ({
  gameId,
  year: 2025,
  week,
  label: 'Test game',
  overtime: 0,
  winnerWinProbability,
  winner: { id: 1, name: 'Alpha', abbreviation: 'ALP', rank: 0, score: 24 },
  loser: { id: 2, name: 'Beta', abbreviation: 'BET', rank: 1, score: 21 },
});

describe('sortBiggestUpsets', () => {
  const source = [
    upset(1, 4, 0.08),
    upset(2, 9, 0.1),
    upset(3, 9, 0.06),
    upset(4, 9, 0.06),
    upset(5, 7, 0.04),
  ];

  it('orders newest weeks first, then magnitude and newest game ID', () => {
    expect(sortBiggestUpsets(source, 'week').map(item => item.gameId))
      .toEqual([4, 3, 2, 5, 1]);
  });

  it('orders lowest winning probability first, then newest week and game ID', () => {
    expect(sortBiggestUpsets(source, 'magnitude').map(item => item.gameId))
      .toEqual([5, 4, 3, 1, 2]);
  });

  it('does not mutate the loader projection', () => {
    const ids = source.map(item => item.gameId);
    sortBiggestUpsets(source, 'magnitude');
    expect(source.map(item => item.gameId)).toEqual(ids);
  });
});
