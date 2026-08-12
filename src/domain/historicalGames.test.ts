import { describe, expect, it } from 'vitest';
import type {
  HistoricalGame,
  HistoricalGamesForTeam,
  HistoricalGamesIndex,
  HistoricalGamesSeason,
} from '../types/baseData';
import {
  buildHistoricalGamesByTeam,
  getHistoricalTeamGamesFileName,
  HistoricalGamesValidationError,
  validateHistoricalGamesForTeam,
  validateHistoricalGamesIndex,
  validateHistoricalGamesSeason,
} from './historicalGames';

const game = (overrides: Partial<HistoricalGame> = {}): HistoricalGame => ({
  sourceId: 10,
  year: 2000,
  weekPlayed: 1,
  seasonType: 'regular',
  homeTeam: 'Texas Christian',
  awayTeam: 'Southern Methodist',
  homeScore: 28,
  awayScore: 14,
  homeRank: 12,
  awayRank: 0,
  neutralSite: false,
  venue: 'Amon G. Carter Stadium',
  name: null,
  label: 'Conference: CUSA',
  ...overrides,
});

const index = (): HistoricalGamesIndex => ({
  source: 'CollegeFootballData.com',
  years: [2000, 2025],
});

const season = (): HistoricalGamesSeason => ({
  year: 2000,
  games: [game()],
});

describe('historical games data', () => {
  it('accepts the exact current index and season shapes', () => {
    expect(validateHistoricalGamesIndex(index())).toEqual(index());
    expect(validateHistoricalGamesSeason(season(), 2000)).toEqual(season());
  });

  it('builds deterministic team-relative lookups and permits empty teams', () => {
    const lookups = buildHistoricalGamesByTeam(
      [{
        year: 2000,
        games: [
          game(),
          game({ sourceId: 20, weekPlayed: 2, homeScore: 21, awayScore: 24 }),
        ],
      }],
      new Set(['Texas Christian', 'Southern Methodist', 'New Program']),
    );

    expect(lookups.map(entry => entry.team)).toEqual([
      'New Program',
      'Southern Methodist',
      'Texas Christian',
    ]);
    expect(lookups[0].games).toEqual([]);
    expect(lookups[2].games).toEqual([
      expect.objectContaining({
        sourceId: 20,
        opponent: 'Southern Methodist',
        teamScore: 21,
        opponentScore: 24,
      }),
      expect.objectContaining({ sourceId: 10, teamScore: 28, opponentScore: 14 }),
    ]);
    expect(validateHistoricalGamesForTeam(
      lookups[2],
      'Texas Christian',
      new Set([2000]),
    )).toEqual(lookups[2]);
    expect(getHistoricalTeamGamesFileName('Texas Christian'))
      .toBe('Texas Christian.json');
  });

  it('rejects malformed, mismatched, duplicated, and unordered team lookups', () => {
    const lookup: HistoricalGamesForTeam = {
      team: 'Texas Christian',
      games: [{
        sourceId: 10,
        year: 2000,
        weekPlayed: 1,
        opponent: 'Southern Methodist',
        teamScore: 28,
        opponentScore: 14,
        label: 'Conference: CUSA',
      }],
    };
    expect(() => validateHistoricalGamesForTeam(lookup, 'Other Team'))
      .toThrow('do not match requested team');
    expect(() => validateHistoricalGamesForTeam(lookup, undefined, new Set([2001])))
      .toThrow('unavailable season');
    expect(() => validateHistoricalGamesForTeam({
      ...lookup,
      games: [lookup.games[0], { ...lookup.games[0] }],
    })).toThrow('duplicated');
    expect(() => validateHistoricalGamesForTeam({
      ...lookup,
      games: [
        lookup.games[0],
        { ...lookup.games[0], sourceId: 20, year: 2001 },
      ],
    })).toThrow('reverse chronological order');
    expect(() => validateHistoricalGamesForTeam({
      ...lookup,
      generated_at: 'legacy',
    })).toThrow('current schema');
    expect(() => getHistoricalTeamGamesFileName('../Texas Christian'))
      .toThrow('invalid');
  });

  it('rejects legacy or extra index fields and invalid years', () => {
    expect(() => validateHistoricalGamesIndex({
      ...index(),
      games: [],
    })).toThrow(HistoricalGamesValidationError);
    expect(() => validateHistoricalGamesIndex({
      ...index(),
      years: [2025, 2000],
    })).toThrow(HistoricalGamesValidationError);
  });

  it('rejects wrong season years, duplicate results, and extra game fields', () => {
    expect(() => validateHistoricalGamesSeason(season(), 2025)).toThrow(
      'does not match requested year',
    );

    const duplicate = season();
    duplicate.games.push(game({ sourceId: 20 }));
    expect(() => validateHistoricalGamesSeason(duplicate)).toThrow(
      'duplicates a matchup result',
    );

    const extra = season();
    extra.games[0] = {
      ...extra.games[0],
      date: '2000-08-26T00:00:00.000Z',
    } as HistoricalGame;
    expect(() => validateHistoricalGamesSeason(extra)).toThrow(
      HistoricalGamesValidationError,
    );
  });

  it('rejects invalid ranks and non-deterministic ordering', () => {
    expect(() => validateHistoricalGamesSeason({
      year: 2000,
      games: [game({ homeRank: 26 })],
    })).toThrow('invalid game');

    expect(() => validateHistoricalGamesSeason({
      year: 2000,
      games: [
        game({ sourceId: 20, weekPlayed: 2 }),
        game({ sourceId: 10, awayScore: 13 }),
      ],
    })).toThrow('chronological order');
  });
});
