import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import type { GameRecord } from '../types/db';
import {
  assertCurrentGameRecord,
  assertCurrentGameRecords,
  assertLeagueGameRecords,
} from './gameRecordValidation';

const upcomingGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: 'Test Stadium',
  winnerId: null,
  baseLabel: 'Test State vs Other State',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 1,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  scoreA: null,
  scoreB: null,
  watchability: 75,
  ...overrides,
});

const completedGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  ...upcomingGame({
    winnerId: 1,
    resultA: 'W',
    resultB: 'L',
    quarter: 4,
    clockSecondsLeft: 0,
    scoreA: 31,
    scoreB: 24,
  }),
  ...overrides,
});

const leagueForGames = () => {
  const teamA = buildTestTeam();
  const teamB = buildTestTeam({
    id: 2,
    name: 'Other State',
    abbreviation: 'OTH',
    ranking: 2,
  });
  const base = buildTestLeague('season');
  return buildTestLeague('season', {
    teams: [teamA, teamB],
    conferences: [{ ...base.conferences[0], teams: [teamA, teamB] }],
    idCounters: { ...base.idCounters, game: 3 },
  });
};

describe('current game-record validation', () => {
  it('accepts exact upcoming, completed, and neutral-site records', () => {
    expect(() => assertCurrentGameRecord(upcomingGame())).not.toThrow();
    expect(() => assertCurrentGameRecord(completedGame())).not.toThrow();
    expect(() => assertCurrentGameRecord(upcomingGame({
      homeTeamId: null,
      awayTeamId: null,
      neutralSite: true,
      venue: null,
    }))).not.toThrow();
  });

  it('rejects missing and unknown fields', () => {
    const { quarter: _quarter, ...missing } = upcomingGame();
    expect(() => assertCurrentGameRecord(missing)).toThrowError(
      expect.objectContaining({ code: 'INVALID_GAME_RECORD' }),
    );
    expect(() => assertCurrentGameRecord({
      ...upcomingGame(),
      legacyClock: 900,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_GAME_RECORD' }));
  });

  it.each([
    ['non-positive game ID', { id: 0 }],
    ['duplicate participants', { teamBId: 1, awayTeamId: 1 }],
    ['invalid home team', { homeTeamId: 3 }],
    ['invalid game type', { gameType: 'legacy_bowl' }],
    ['invalid spread', { spreadA: 'three' }],
    ['invalid moneyline', { moneylineA: '150' }],
    ['non-finite probability', { winProbA: Number.NaN }],
    ['non-complementary probabilities', { winProbA: 0.7 }],
    ['non-positive week', { weekPlayed: 0 }],
    ['non-positive rank', { rankATOG: 0 }],
    ['null watchability', { watchability: null }],
    ['non-finite watchability', { watchability: Number.POSITIVE_INFINITY }],
    ['invalid quarter', { quarter: 5 }],
    ['invalid clock', { clockSecondsLeft: 901 }],
  ])('rejects %s', (_label, override) => {
    expect(() => assertCurrentGameRecord({
      ...upcomingGame(),
      ...override,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_GAME_RECORD' }));
  });

  it.each([
    ['an upcoming game with a progressed clock', upcomingGame({ clockSecondsLeft: 899 })],
    ['a completed game without a winner', completedGame({ winnerId: null })],
    ['a completed tie', completedGame({ scoreB: 31 })],
    ['results that disagree with the winner', completedGame({ resultA: 'L', resultB: 'W' })],
    ['an unfinished completed clock', completedGame({ clockSecondsLeft: 1 })],
  ])('rejects %s', (_label, game) => {
    expect(() => assertCurrentGameRecord(game)).toThrowError(
      expect.objectContaining({ code: 'INVALID_GAME_RECORD' }),
    );
  });

  it('rejects duplicate IDs and invalid league references', () => {
    expect(() => assertCurrentGameRecords([
      upcomingGame(),
      upcomingGame(),
    ])).toThrowError(expect.objectContaining({ code: 'INVALID_GAME_RECORD' }));
    expect(() => assertLeagueGameRecords(
      leagueForGames(),
      [upcomingGame({ teamBId: 99, awayTeamId: 99 })],
    )).toThrowError(expect.objectContaining({ code: 'INVALID_GAME_RECORD' }));
    expect(() => assertLeagueGameRecords(
      leagueForGames(),
      [upcomingGame({ id: 3 })],
    )).toThrowError(expect.objectContaining({ code: 'INVALID_GAME_RECORD' }));
  });
});
