import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildRecruitingState } from '../test/recruitingFixtures';
import {
  buildTestLeague,
  buildTestPlayer,
} from '../test/fixtures';
import type { LeagueState } from '../types/league';
import type { RecruitingState } from '../types/recruiting';
import {
  DB_NAME,
  DB_VERSION,
  deleteCurrentDatabase,
  getDb,
} from './db';
import { initializeDatabase } from './databaseLifecycle';

const resetDatabase = async () => {
  await deleteCurrentDatabase();
  await getDb();
};

const currentSaveCounts = async () => {
  const db = await getDb();
  return Promise.all([
    db.count('league'),
    db.count('recruiting'),
    db.count('players'),
    db.count('games'),
    db.count('gameDetails'),
    db.count('playerSeasons'),
    db.count('historicalPlayers'),
    db.count('playerOrigins'),
    db.count('seasonMemories'),
  ]);
};

describe('database startup lifecycle', () => {
  beforeEach(resetDatabase);

  it('preserves a valid current save', async () => {
    const db = await getDb();
    const league = buildTestLeague('season');
    const player = buildTestPlayer();
    await db.put('league', { key: 'current', value: league });
    await db.put('players', player);
    await db.put('playerOrigins', {
      playerId: player.id,
      kind: 'initial_roster',
      acquisitionYear: league.info.startYear,
      originalTeamId: player.teamId,
      classAtStart: player.year,
    });

    await initializeDatabase();

    const current = await getDb();
    expect((await current.get('league', 'current'))?.value).toEqual(league);
    expect(await current.get('players', player.id)).toEqual(player);
  });

  it('deletes the database when the current league is malformed', async () => {
    const db = await getDb();
    const malformed = buildTestLeague('season');
    delete (malformed as Partial<LeagueState>).settings;
    await db.put('league', { key: 'current', value: malformed });
    await db.put('players', buildTestPlayer());
    await db.put('baseData', { key: 'marker', value: 'discarded' });

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await (await getDb()).get('baseData', 'marker')).toBeUndefined();
  });

  it('requires the current seasonal rivalry opt-out state', async () => {
    const db = await getDb();
    const malformed = buildTestLeague('season');
    delete (malformed as Partial<LeagueState>).declinedRivalries;
    await db.put('league', { key: 'current', value: malformed });
    await db.put('players', buildTestPlayer());

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when the current roster is malformed', async () => {
    const db = await getDb();
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('season'),
    });
    await db.put('players', buildTestPlayer({ first: '' }));

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when a player origin is missing or orphaned', async () => {
    const db = await getDb();
    const league = buildTestLeague('season');
    const player = buildTestPlayer();
    await db.put('league', { key: 'current', value: league });
    await db.put('players', player);

    await initializeDatabase();
    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const current = await getDb();
    await current.put('playerOrigins', {
      playerId: 999,
      kind: 'walk_on',
      acquisitionYear: league.info.startYear,
      originalTeamId: player.teamId,
    });
    await initializeDatabase();
    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when recruiting state is malformed', async () => {
    const db = await getDb();
    const malformed = {
      ...buildRecruitingState(),
      version: undefined,
    } as unknown as RecruitingState;
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('recruiting'),
    });
    await db.put('players', buildTestPlayer());
    await db.put('recruiting', { key: 'current', value: malformed });

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes orphaned save records without a league', async () => {
    const db = await getDb();
    await db.put('players', buildTestPlayer());

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('recreates a malformed current-version store schema', async () => {
    await deleteCurrentDatabase();
    const malformed = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('league', { keyPath: 'key' });
      },
    });
    malformed.close();

    await initializeDatabase();

    const current = await getDb();
    expect(Array.from(current.objectStoreNames)).toEqual([
      'baseData',
      'gameDetails',
      'games',
      'historicalPlayers',
      'league',
      'playerOrigins',
      'playerSeasons',
      'players',
      'recruiting',
      'seasonMemories',
    ]);
  });
});
