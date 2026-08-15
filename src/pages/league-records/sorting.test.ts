import { describe, expect, it } from 'vitest';
import type { LeagueRecordProgram } from '../../domain/league/loaders/leagueRecords';
import { sortLeagueRecords } from './sorting';

const program = (
  name: string,
  overrides: Partial<LeagueRecordProgram> = {},
): LeagueRecordProgram => ({
  name,
  active: true,
  conference: 'Test',
  seasons: 2,
  wins: 10,
  losses: 3,
  winPercentage: 10 / 13,
  bestSeason: { year: 2024, wins: 10, losses: 3, finalRank: 8 },
  bestFinalRank: 8,
  nationalTitles: 0,
  conferenceTitles: 0,
  playoffAppearances: 0,
  bowlWins: 0,
  awardWinners: 0,
  ...overrides,
});

describe('league records sorting', () => {
  it('sorts wins descending with fewer losses and name as deterministic ties', () => {
    const rows = sortLeagueRecords([
      program('Zulu', { wins: 12, losses: 3 }),
      program('Alpha', { wins: 12, losses: 2 }),
      program('Beta', { wins: 12, losses: 2 }),
      program('Small', { wins: 8, losses: 0 }),
    ], 'wins', 'desc');

    expect(rows.map(row => [row.rank, row.name])).toEqual([
      [1, 'Alpha'], [2, 'Beta'], [3, 'Zulu'], [4, 'Small'],
    ]);
  });

  it('keeps unranked programs last in either best-rank direction', () => {
    const programs = [
      program('Unranked', { bestFinalRank: null }),
      program('Number One', { bestFinalRank: 1 }),
      program('Number Ten', { bestFinalRank: 10 }),
    ];
    expect(sortLeagueRecords(programs, 'bestFinalRank', 'asc').map(row => row.name)).toEqual([
      'Number One', 'Number Ten', 'Unranked',
    ]);
    expect(sortLeagueRecords(programs, 'bestFinalRank', 'desc').map(row => row.name)).toEqual([
      'Number Ten', 'Number One', 'Unranked',
    ]);
  });

  it('uses the complete best-season order and keeps missing seasons last', () => {
    const rows = sortLeagueRecords([
      program('Older', { bestSeason: { year: 2023, wins: 10, losses: 2, finalRank: 3 } }),
      program('Newer', { bestSeason: { year: 2024, wins: 10, losses: 2, finalRank: 3 } }),
      program('Lower Rank', { bestSeason: { year: 2024, wins: 10, losses: 2, finalRank: 6 } }),
      program('Missing', { bestSeason: null }),
    ], 'bestSeason', 'desc');

    expect(rows.map(row => row.name)).toEqual(['Newer', 'Older', 'Lower Rank', 'Missing']);
  });
});
