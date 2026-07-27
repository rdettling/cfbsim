import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { commitOffseasonTransition } from './offseasonRepo';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type LeagueState,
} from '../types/league';
import type { PlayerRecord } from '../types/db';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';

const resetDatabase = async () => {
  const db = await getDb();
  const stores = [
    'baseData',
    'league',
    'players',
    'games',
    'drives',
    'plays',
    'gameLogs',
  ] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const seedLeague = async (league: LeagueState) => {
  const db = await getDb();
  await db.put('league', { key: 'current', value: league });
};

describe('commitOffseasonTransition', () => {
  beforeEach(resetDatabase);

  it('allows only one concurrent command to commit', async () => {
    await seedLeague(buildTestLeague('recruiting_summary'));

    const firstLeague = buildTestLeague('roster_cuts');
    const secondLeague = buildTestLeague('roster_cuts');
    const results = await Promise.allSettled([
      commitOffseasonTransition({
        expectedStage: 'recruiting_summary',
        league: firstLeague,
      }),
      commitOffseasonTransition({
        expectedStage: 'recruiting_summary',
        league: secondLeague,
      }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find(result => result.status === 'rejected');
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: expect.any(OffseasonStageMismatchError),
    });

    const db = await getDb();
    const persisted = await db.get('league', 'current');
    expect((persisted?.value as LeagueState).info.stage).toBe('roster_cuts');
  });

  it('rolls back earlier writes when a later store write fails', async () => {
    const sourceLeague = buildTestLeague('summary');
    await seedLeague(sourceLeague);
    const db = await getDb();
    const originalHistory = {
      generated_at: 'test',
      years: [2024],
      conf_index: { 'Test Conference': 1 },
      teams: {},
    };
    await db.put('baseData', { key: 'history', value: originalHistory });

    const invalidPlayer = {} as PlayerRecord;
    await expect(
      commitOffseasonTransition({
        expectedStage: 'summary',
        league: buildTestLeague('realignment'),
        history: {
          ...originalHistory,
          years: [2025, 2024],
        },
        players: [invalidPlayer],
      }),
    ).rejects.toBeDefined();

    const persistedLeague = await db.get('league', 'current');
    const persistedHistory = await db.get('baseData', 'history');
    expect((persistedLeague?.value as LeagueState).info.stage).toBe('summary');
    expect(persistedHistory?.value).toEqual(originalHistory);
    expect(await db.getAll('players')).toEqual([]);
  });

  it('commits preseason artifacts and clears prior play-by-play atomically', async () => {
    await seedLeague(buildTestLeague('roster_cuts'));
    const db = await getDb();
    await db.put('drives', {
      id: 1,
      gameId: 1,
      driveNum: 1,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      result: 'Touchdown',
      points: 7,
      points_needed: 7,
      scoreAAfter: 7,
      scoreBAfter: 0,
    });
    await db.put('plays', {
      id: 1,
      gameId: 1,
      driveId: 1,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      down: 1,
      yardsLeft: 10,
      playType: 'run',
      yardsGained: 5,
      result: 'gain',
      text: 'Run for five',
      header: '1st & 10',
      scoreA: 0,
      scoreB: 0,
    });
    await db.put('gameLogs', {
      id: 1,
      playerId: 1,
      gameId: 1,
      pass_yards: 0,
      pass_attempts: 0,
      pass_completions: 0,
      pass_touchdowns: 0,
      pass_interceptions: 0,
      rush_yards: 5,
      rush_attempts: 1,
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
    });

    await commitOffseasonTransition({
      expectedStage: 'roster_cuts',
      league: buildTestLeague('preseason'),
      players: [buildTestPlayer()],
      clearNonGameArtifacts: true,
    });

    expect(await db.getAll('drives')).toEqual([]);
    expect(await db.getAll('plays')).toEqual([]);
    expect(await db.getAll('gameLogs')).toEqual([]);
    expect(await db.getAll('players')).toEqual([buildTestPlayer()]);
  });

  it('rejects a realignment commit prepared from stale settings', async () => {
    const source = buildTestLeague('realignment');
    await seedLeague(source);
    const db = await getDb();
    const changed = structuredClone(source);
    changed.settings!.auto_realignment = false;
    await db.put('league', { key: 'current', value: changed });

    const destination = structuredClone(source);
    destination.info.stage = 'progression';
    destination.info.currentYear += 1;

    await expect(
      commitOffseasonTransition({
        expectedStage: 'realignment',
        expectedSettings: source.settings,
        league: destination,
      }),
    ).rejects.toBeInstanceOf(OffseasonConfigurationConflictError);

    const persisted = await db.get('league', 'current');
    expect((persisted?.value as LeagueState).info).toMatchObject({
      stage: 'realignment',
      currentYear: 2025,
    });
    expect((persisted?.value as LeagueState).settings?.auto_realignment).toBe(
      false,
    );
  });
});
