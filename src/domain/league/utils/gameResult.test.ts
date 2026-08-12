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

    const result = buildPreviousMatchups({
      targetGame: target,
      simulatedGames: [...meetings, unrelated, incomplete, target],
      historicalGames: [],
      dynastyStartYear: 2021,
      teamBName: 'Beta',
    });

    expect(result.rows).toHaveLength(5);
    expect(result.rows.map(entry => entry.year)).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(result.rows[0]).toMatchObject({
      teamAScore: 15,
      teamBScore: 25,
      winnerSide: 'teamB',
      gameId: 6,
      source: 'simulated',
    });
    expect(result.series).toEqual({ teamAWins: 3, teamBWins: 3, ties: 0 });
  });

  it('merges pre-dynasty history and keeps the latest five meetings', () => {
    const target = game({ id: 100, year: 2027, winnerId: null });
    const result = buildPreviousMatchups({
      targetGame: target,
      simulatedGames: [game({ id: 50, year: 2026 })],
      historicalGames: Array.from({ length: 6 }, (_, index) => ({
        sourceId: 1000 + index,
        year: 2025 - index,
        weekPlayed: 10,
        opponent: 'Beta',
        teamScore: 30 - index,
        opponentScore: 20,
        label: 'Historical Matchup',
      })),
      dynastyStartYear: 2026,
      teamBName: 'Beta',
    });

    expect(result.rows.map(entry => entry.year)).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(result.rows[1]).toMatchObject({
      rowKey: 'historical:1000',
      source: 'historical',
      gameId: null,
      winnerSide: 'teamA',
    });
    expect(result.series).toEqual({ teamAWins: 7, teamBWins: 0, ties: 0 });
  });

  it('excludes static dynasty overlap and other opponents', () => {
    const target = game({ id: 100, year: 2027, winnerId: null });
    const historicalGames = [
      { sourceId: 1, year: 2025, opponent: 'Beta', label: 'Included' },
      { sourceId: 2, year: 2026, opponent: 'Beta', label: 'Dynasty overlap' },
      { sourceId: 3, year: 2024, opponent: 'Gamma', label: 'Other opponent' },
    ].map(entry => ({
      weekPlayed: 1,
      teamScore: 24,
      opponentScore: 17,
      ...entry,
    }));
    const result = buildPreviousMatchups({
      targetGame: target,
      simulatedGames: [],
      historicalGames,
      dynastyStartYear: 2026,
      teamBName: 'Beta',
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].rowKey).toBe('historical:1');
    expect(result.series).toEqual({ teamAWins: 1, teamBWins: 0, ties: 0 });
  });
});
