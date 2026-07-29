import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import {
  DB_VERSION,
  type Frontend2DB,
  upgradeDatabase,
} from './db';

describe('current database schema', () => {
  it('creates every authoritative store in a fresh database', async () => {
    const name = `cfbsim-current-schema-${Date.now()}`;
    const db = await openDB<Frontend2DB>(name, DB_VERSION, {
      upgrade: upgradeDatabase,
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
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
});
