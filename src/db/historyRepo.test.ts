import { describe, expect, it } from 'vitest';
import { buildTestPlayer } from '../test/fixtures';
import { buildGameDetail, buildPlayerSeasons } from '../domain/league/gameDetails';
import {
  assertHistoricalIntegrity,
  isGameDetail,
  isHistoricalPlayer,
  isPlayerSeason,
} from './historyRepo';

describe('historical data integrity', () => {
  const current = buildTestPlayer();
  const detail = buildGameDetail(1, 2025, [], [], []);
  const season = buildPlayerSeasons(
    2025,
    [
      buildGameDetail(1, 2025, [], [], [{
        playerId: 1,
        gameId: 1,
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
        tackles: 1,
        sacks: 0,
        interceptions: 0,
        fumbles_forced: 0,
        fumbles_recovered: 0,
        field_goals_made: 0,
        field_goals_attempted: 0,
        extra_points_made: 0,
        extra_points_attempted: 0,
      }]),
    ],
    [current],
  )[0];

  it('accepts exact current records and rejects fallback fields', () => {
    expect(isGameDetail(detail)).toBe(true);
    expect(isPlayerSeason(season)).toBe(true);
    expect(
      isHistoricalPlayer({
        id: 2,
        first: 'Past',
        last: 'Player',
        pos: 'lb',
        stars: 4,
        development_trait: 3,
      }),
    ).toBe(true);
    expect(isGameDetail({ ...detail, legacyPlays: [] })).toBe(false);
    expect(isPlayerSeason({ ...season, completionPercentage: 0 })).toBe(false);
  });

  it('rejects duplicate identities and dangling references', () => {
    expect(() =>
      assertHistoricalIntegrity({
        currentPlayers: [current],
        historicalPlayers: [{
          id: current.id,
          first: current.first,
          last: current.last,
          pos: current.pos,
          stars: current.stars,
          development_trait: current.development_trait,
        }],
        playerSeasons: [season],
        details: [detail],
        gameIds: new Set([1]),
      }),
    ).toThrow(/multiple stores/);
    expect(() =>
      assertHistoricalIntegrity({
        currentPlayers: [],
        historicalPlayers: [],
        playerSeasons: [season],
        details: [],
        gameIds: new Set(),
      }),
    ).toThrow(/dangling/);
  });
});
