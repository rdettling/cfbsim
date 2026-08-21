import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import {
  DB_VERSION,
  type CfbSimDB,
  upgradeDatabase,
} from './db';

const deleteTestDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

describe('current database schema', () => {
  it('uses the completed-season-finalization schema epoch', () => {
    expect(DB_VERSION).toBe(29);
  });

  it('creates every authoritative store in a fresh database', async () => {
    const name = `cfbsim-current-schema-${Date.now()}`;
    const db = await openDB<CfbSimDB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });

    expect(Array.from(db.objectStoreNames)).toEqual([
      'baseData',
      'gameDetails',
      'games',
      'historicalPlayers',
      'league',
      'newsItems',
      'playerOrigins',
      'playerSeasons',
      'players',
      'recruiting',
      'seasonMemories',
    ]);

    db.close();
    await deleteTestDatabase(name);
  });

  it('replaces every legacy store during a version upgrade', async () => {
    const name = `cfbsim-destructive-upgrade-${Date.now()}`;
    const legacy = await openDB(name, 26, {
      upgrade(database) {
        database.createObjectStore('league', { keyPath: 'key' });
        database.createObjectStore('obsolete', { keyPath: 'id' });
      },
    });
    await legacy.put('league', { key: 'current', value: { legacy: true } });
    await legacy.put('obsolete', { id: 1 });
    legacy.close();

    const current = await openDB<CfbSimDB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });

    expect(Array.from(current.objectStoreNames)).toEqual([
      'baseData',
      'gameDetails',
      'games',
      'historicalPlayers',
      'league',
      'newsItems',
      'playerOrigins',
      'playerSeasons',
      'players',
      'recruiting',
      'seasonMemories',
    ]);
    expect(await current.getAll('league')).toEqual([]);
    expect(Array.from(current.transaction('games').store.indexNames)).toEqual([
      'teamAId',
      'teamBId',
      'weekPlayed',
      'winnerId',
      'year',
    ]);
    expect(Array.from(current.transaction('newsItems').store.indexNames)).toEqual([
      'gameId',
      'year',
      'yearWeek',
    ]);

    current.close();
    await deleteTestDatabase(name);
  });

  it('preserves data when reopening the current schema version', async () => {
    const name = `cfbsim-current-reopen-${Date.now()}`;
    const first = await openDB<CfbSimDB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });
    await first.put('baseData', { key: 'marker', value: 'current' });
    first.close();

    const reopened = await openDB<CfbSimDB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });
    expect(await reopened.get('baseData', 'marker')).toEqual({
      key: 'marker',
      value: 'current',
    });

    reopened.close();
    await deleteTestDatabase(name);
  });
});
