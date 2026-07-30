import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import {
  DB_VERSION,
  type Frontend2DB,
  upgradeDatabase,
} from './db';

const deleteTestDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

describe('current database schema', () => {
  it('creates every authoritative store in a fresh database', async () => {
    const name = `cfbsim-current-schema-${Date.now()}`;
    const db = await openDB<Frontend2DB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });

    expect(Array.from(db.objectStoreNames)).toEqual([
      'baseData',
      'drives',
      'gameLogs',
      'games',
      'league',
      'players',
      'plays',
      'recruiting',
    ]);

    db.close();
    await deleteTestDatabase(name);
  });

  it('replaces every legacy store during a version upgrade', async () => {
    const name = `cfbsim-destructive-upgrade-${Date.now()}`;
    const legacy = await openDB(name, DB_VERSION - 1, {
      upgrade(database) {
        database.createObjectStore('league', { keyPath: 'key' });
        database.createObjectStore('obsolete', { keyPath: 'id' });
      },
    });
    await legacy.put('league', { key: 'current', value: { legacy: true } });
    await legacy.put('obsolete', { id: 1 });
    legacy.close();

    const current = await openDB<Frontend2DB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });

    expect(Array.from(current.objectStoreNames)).toEqual([
      'baseData',
      'drives',
      'gameLogs',
      'games',
      'league',
      'players',
      'plays',
      'recruiting',
    ]);
    expect(await current.getAll('league')).toEqual([]);
    expect(Array.from(current.transaction('games').store.indexNames)).toEqual([
      'teamAId',
      'teamBId',
      'weekPlayed',
      'winnerId',
    ]);

    current.close();
    await deleteTestDatabase(name);
  });

  it('preserves data when reopening the current schema version', async () => {
    const name = `cfbsim-current-reopen-${Date.now()}`;
    const first = await openDB<Frontend2DB>(name, DB_VERSION, {
      upgrade: (database, oldVersion) =>
        upgradeDatabase(database, oldVersion),
    });
    await first.put('baseData', { key: 'marker', value: 'current' });
    first.close();

    const reopened = await openDB<Frontend2DB>(name, DB_VERSION, {
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
