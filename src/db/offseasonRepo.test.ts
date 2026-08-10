import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { commitOffseasonTransition } from './offseasonRepo';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type LeagueState,
} from '../types/league';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestSeasonTeamSnapshot,
} from '../test/fixtures';
import { buildGameDetail, buildPlayerSeasons } from '../domain/league/gameDetails';

const resetDatabase = async () => {
  const db = await getDb();
  const stores = ['baseData', 'league', 'players', 'playerOrigins'] as const;
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
    await seedLeague(buildTestLeague('summary'));

    const firstLeague = buildTestLeague('realignment');
    const secondLeague = buildTestLeague('realignment');
    const results = await Promise.allSettled([
      commitOffseasonTransition({
        expectedStage: 'summary',
        league: firstLeague,
      }),
      commitOffseasonTransition({
        expectedStage: 'summary',
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
    expect((persisted?.value as LeagueState).info.stage).toBe('realignment');
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

    const invalidLeague = buildTestLeague('realignment') as LeagueState & {
      invalidValue?: () => void;
    };
    invalidLeague.invalidValue = () => undefined;
    await expect(
      commitOffseasonTransition({
        expectedStage: 'summary',
        league: invalidLeague,
        history: {
          ...originalHistory,
          years: [2025, 2024],
        },
      }),
    ).rejects.toBeDefined();

    const persistedLeague = await db.get('league', 'current');
    const persistedHistory = await db.get('baseData', 'history');
    expect((persistedLeague?.value as LeagueState).info.stage).toBe('summary');
    expect(persistedHistory?.value).toEqual(originalHistory);
  });

  it('rejects a realignment commit prepared from stale settings', async () => {
    const source = buildTestLeague('realignment');
    await seedLeague(source);
    const db = await getDb();
    const changed = structuredClone(source);
    changed.settings.conferencePolicy = 'current';
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
    expect(
      (persisted?.value as LeagueState).settings.conferencePolicy,
    ).toBe('current');
  });

  it('atomically adds a program, its players, and their origins', async () => {
    const source = buildTestLeague('realignment');
    await seedLeague(source);
    const db = await getDb();
    await db.put('players', buildTestPlayer());

    const destination = structuredClone(source);
    const entryTeam = {
      ...destination.teams[0],
      id: 2,
      name: 'Entry State',
      abbreviation: 'ENT',
      ranking: 2,
    };
    destination.teams.push(entryTeam);
    destination.info.currentYear += 1;
    destination.info.stage = 'progression';
    destination.idCounters.player = 3;
    const player = buildTestPlayer({ id: 2, teamId: 2, year: 'fr' });
    const origin = {
      playerId: 2,
      kind: 'program_entry' as const,
      acquisitionYear: destination.info.currentYear,
      originalTeamId: 2,
      classAtEntry: 'fr' as const,
    };

    await commitOffseasonTransition({
      expectedStage: 'realignment',
      expectedSettings: source.settings,
      league: destination,
      players: [player],
      playerOrigins: [origin],
    });

    expect(await db.get('players', 2)).toEqual(player);
    expect(await db.get('playerOrigins', 2)).toEqual(origin);
    expect((await db.get('league', 'current'))?.value).toEqual(destination);
  });

  it('rolls back the realignment when an entry-origin insert conflicts', async () => {
    const source = buildTestLeague('realignment');
    await seedLeague(source);
    const db = await getDb();
    await db.put('players', buildTestPlayer());
    await db.put('playerOrigins', {
      playerId: 2,
      kind: 'walk_on',
      acquisitionYear: source.info.currentYear,
      originalTeamId: 1,
    });

    const destination = structuredClone(source);
    destination.teams.push({
      ...destination.teams[0],
      id: 2,
      name: 'Entry State',
      abbreviation: 'ENT',
      ranking: 2,
    });
    destination.info.currentYear += 1;
    destination.info.stage = 'progression';
    const player = buildTestPlayer({ id: 2, teamId: 2 });

    await expect(commitOffseasonTransition({
      expectedStage: 'realignment',
      expectedSettings: source.settings,
      league: destination,
      players: [player],
      playerOrigins: [{
        playerId: 2,
        kind: 'program_entry',
        acquisitionYear: destination.info.currentYear,
        originalTeamId: 2,
        classAtEntry: player.year,
      }],
    })).rejects.toBeDefined();

    expect(await db.get('players', 2)).toBeUndefined();
    expect((await db.get('league', 'current'))?.value).toEqual(source);
    expect(await db.get('playerOrigins', 2)).toMatchObject({ kind: 'walk_on' });
  });

  it('atomically writes annual aggregates and prunes non-retained detail', async () => {
    const source = buildTestLeague('summary');
    await seedLeague(source);
    const db = await getDb();
    const player = buildTestPlayer();
    const stats = {
      playerId: player.id,
      gameId: 1,
      pass_yards: 100,
      pass_attempts: 10,
      pass_completions: 7,
      pass_touchdowns: 1,
      pass_interceptions: 0,
      rush_yards: 5,
      rush_attempts: 2,
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
    };
    const details = [
      buildGameDetail(1, 2025, [], [], [stats]),
      buildGameDetail(2, 2025, [], [], []),
      buildGameDetail(3, 2025, [], [], []),
    ];
    for (const detail of details) await db.put('gameDetails', detail);
    const playerSeasons = buildPlayerSeasons(2025, details, [player]);
    const memory = {
      year: 2025,
      playoffTeams: 12 as const,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot(),
      ],
      events: [{ type: 'playoff_semifinal' as const, gameId: 3 }],
      awards: [],
    };
    const destination = buildTestLeague('realignment');

    await commitOffseasonTransition({
      expectedStage: 'summary',
      league: destination,
      memory,
      playerSeasons,
      retainedGameIds: new Set([1, 3]),
    });

    expect(await db.getAllKeys('gameDetails')).toEqual([1, 3]);
    expect(await db.getAll('playerSeasons')).toEqual(playerSeasons);
    expect(await db.get('seasonMemories', 2025)).toEqual(memory);
    expect(
      ((await db.get('league', 'current'))?.value as LeagueState).info.stage,
    ).toBe('realignment');
  });

});
