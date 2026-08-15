import { describe, expect, it } from 'vitest';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import type { GameLogRecord, PlayerRecord } from '../../types/db';
import { buildAwards } from './awards';

const log = (
  playerId: number,
  overrides: Partial<GameLogRecord> = {},
): GameLogRecord => ({
  playerId,
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
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
  ...overrides,
});

const player = (
  id: number,
  pos: string,
  overrides: Partial<PlayerRecord> = {},
) => buildTestPlayer({
  id,
  pos,
  first: `Player${id}`,
  last: pos.toUpperCase(),
  ...overrides,
});

const league = buildTestLeague('season', {
  teams: [buildTestTeam({ gamesPlayed: 10, ranking: 1 })],
});

const entry = (
  awards: ReturnType<typeof buildAwards>['live'],
  categorySlug: string,
) => awards.find(award => award.categorySlug === categorySlug)!;

describe('buildAwards', () => {
  it('returns all nine categories with empty placements when no players are eligible', () => {
    const result = buildAwards(league, [], []);

    expect(result.live).toHaveLength(9);
    expect(result.live.flatMap(award => award.placements)).toHaveLength(27);
    expect(result.live.every(award =>
      award.placements.every(placement => placement.player === null),
    )).toBe(true);
  });

  it('preserves every award formula and complete representative stat lines', () => {
    const players = [
      player(1, 'qb'),
      player(2, 'rb'),
      player(3, 'wr'),
      player(4, 'dl'),
      player(5, 'lb'),
      player(6, 'cb'),
      player(7, 'k'),
    ];
    const logs = [
      log(1, {
        pass_completions: 200,
        pass_attempts: 300,
        pass_yards: 3_000,
        pass_touchdowns: 30,
        pass_interceptions: 10,
        rush_attempts: 20,
        rush_yards: 100,
        rush_touchdowns: 2,
      }),
      log(2, { rush_attempts: 200, rush_yards: 1_600, rush_touchdowns: 15 }),
      log(3, {
        receiving_catches: 100,
        receiving_yards: 1_400,
        receiving_touchdowns: 14,
      }),
      log(4, { tackles: 90, sacks: 10, interceptions: 2 }),
      log(5, { tackles: 120, sacks: 5, interceptions: 4 }),
      log(6, { tackles: 70, sacks: 1, interceptions: 8 }),
      log(7, {
        field_goals_made: 20,
        field_goals_attempted: 25,
        extra_points_made: 40,
        extra_points_attempted: 41,
      }),
    ];

    const { live } = buildAwards(league, players, logs);

    expect(entry(live, 'heisman').placements[0]).toMatchObject({
      player: { id: 1 },
      score: 333.1,
      statLine: '200/300, 3000 pass yds, 30 pass TD, 10 INT · 20 carries, 100 rush yds, 2 rush TD',
    });
    expect(entry(live, 'davey_obrien').placements[0].score).toBe(377);
    expect(entry(live, 'doak_walker').placements[0].score).toBe(368);
    expect(entry(live, 'biletnikoff').placements[0].score).toBe(360);
    expect(entry(live, 'bednarik').placements[0]).toMatchObject({ player: { id: 5 }, score: 292 });
    expect(entry(live, 'ted_hendricks').placements[0].score).toBe(238);
    expect(entry(live, 'butkus').placements[0].score).toBe(248);
    expect(entry(live, 'thorpe').placements[0].score).toBe(182);
    expect(entry(live, 'lou_groza').placements[0]).toMatchObject({
      score: 128,
      statLine: '20/25 FG, 40/41 XP',
    });
  });

  it('limits live races to the top three eligible starters', () => {
    const players = [
      player(1, 'qb', { rating: 90 }),
      player(2, 'qb', { rating: 80 }),
      player(3, 'qb', { rating: 70 }),
      player(4, 'qb', { rating: 99, starter: false }),
      player(5, 'rb', { rating: 99 }),
    ];
    const logs = players.map(candidate => log(candidate.id, {
      pass_completions: 20,
      pass_attempts: 30,
      pass_yards: 300,
      pass_touchdowns: 3,
      pass_interceptions: 1,
    }));

    const davey = entry(buildAwards(league, players, logs).live, 'davey_obrien');
    expect(davey.placements.map(placement => placement.player?.id)).toEqual([1, 2, 3]);
  });

  it('keeps final winners unique while retaining the displaced leader as a finalist', () => {
    const players = [
      player(1, 'qb', { rating: 90 }),
      player(2, 'qb', { rating: 80 }),
      player(3, 'qb', { rating: 70 }),
    ];
    const logs = players.map(candidate => log(candidate.id, {
      pass_completions: 200,
      pass_attempts: 300,
      pass_yards: 3_000,
      pass_touchdowns: 30,
      pass_interceptions: 10,
    }));
    const { live, final } = buildAwards(league, players, logs);
    const finalHeisman = final.find(award => award.categorySlug === 'heisman')!;
    const finalDavey = final.find(award => award.categorySlug === 'davey_obrien')!;

    expect(entry(live, 'heisman').placements[0].player?.id).toBe(1);
    expect(entry(live, 'davey_obrien').placements[0].player?.id).toBe(1);
    expect(finalHeisman.placements[0].player?.id).toBe(1);
    expect(finalDavey.placements.map(placement => placement.player?.id)).toEqual([2, 1, 3]);
    const winners = final
      .map(award => award.placements[0].player?.id)
      .filter((id): id is number => id !== undefined);
    expect(new Set(winners).size).toBe(winners.length);
  });
});
