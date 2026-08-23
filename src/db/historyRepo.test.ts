import { describe, expect, it } from 'vitest';
import { buildTestPlayer } from '../test/fixtures';
import type { HistoricalPlayerRecord, PlayerSeasonStats } from '../types/db';
import { assertHistoricalIntegrity } from './historyRepo';

const historicalPlayer = (
  overrides: Partial<HistoricalPlayerRecord> = {},
): HistoricalPlayerRecord => ({
  id: 2,
  first: 'Past',
  last: 'Player',
  pos: 'lb',
  stars: 4,
  ...overrides,
});

const season = (overrides: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats => ({
  year: 2025,
  playerId: 2,
  teamId: 1,
  position: 'lb',
  classYear: 'sr',
  rating: 82,
  starter: true,
  games: 12,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 20,
  sacks: 2,
  interceptions: 0,
  fumbles_forced: 1,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
  ...overrides,
});

describe('historical player integrity', () => {
  it('accepts exact identities and player seasons', () => {
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [buildTestPlayer()],
      historicalPlayers: [historicalPlayer()],
      playerSeasons: [season()],
    })).not.toThrow();
  });

  it('rejects unknown fields and incomplete player-season shapes', () => {
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [],
      historicalPlayers: [{ ...historicalPlayer(), legacy: true } as HistoricalPlayerRecord],
      playerSeasons: [],
    })).toThrow(/current data model/);
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [],
      historicalPlayers: [historicalPlayer()],
      playerSeasons: [{ ...season(), starter: undefined } as unknown as PlayerSeasonStats],
    })).toThrow(/current data model/);
  });

  it('rejects duplicate identities and dangling or duplicate seasons', () => {
    const current = buildTestPlayer({ id: 2 });
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [current],
      historicalPlayers: [historicalPlayer()],
      playerSeasons: [],
    })).toThrow(/multiple stores/);
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [],
      historicalPlayers: [historicalPlayer()],
      playerSeasons: [season({ playerId: 99 })],
    })).toThrow(/dangling/);
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [],
      historicalPlayers: [historicalPlayer()],
      playerSeasons: [season(), season()],
    })).toThrow(/duplicate/);
  });
});
