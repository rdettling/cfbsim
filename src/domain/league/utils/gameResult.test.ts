import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../../../types/db';
import { buildPreviousMatchups } from './gameResult';

const game = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 10,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 2,
  awayTeamId: 1,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: 'Annual Matchup',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 8,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  scoreA: 27,
  scoreB: 20,
  watchability: 80,
  ...overrides,
});

describe('buildPreviousMatchups', () => {
  it('returns prior completed meetings for a scheduled target and excludes unfinished games', () => {
    const target = game({
      id: 100,
      year: 2028,
      weekPlayed: 9,
      winnerId: null,
      resultA: null,
      resultB: null,
      scoreA: null,
      scoreB: null,
    });
    const meetings = Array.from({ length: 6 }, (_, index) =>
      game({
        id: index + 1,
        year: 2021 + index,
        teamAId: index % 2 === 0 ? 1 : 2,
        teamBId: index % 2 === 0 ? 2 : 1,
        scoreA: 20 + index,
        scoreB: 10 + index,
        winnerId: index % 2 === 0 ? 1 : 2,
      }),
    );
    const unrelated = game({ id: 90, teamBId: 3, year: 2027 });
    const incomplete = game({ id: 91, year: 2027, winnerId: null });

    const result = buildPreviousMatchups(target, [...meetings, unrelated, incomplete, target]);

    expect(result).toHaveLength(5);
    expect(result.map(entry => entry.year)).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(result[0]).toMatchObject({ teamAScore: 15, teamBScore: 25, winnerId: 2 });
  });
});
