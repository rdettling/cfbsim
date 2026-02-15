import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export const DB_NAME = 'cfbsim_frontend2';
export const DB_VERSION = 1;

export interface Frontend2DB extends DBSchema {
  baseData: {
    key: string;
    value: { key: string; value: unknown };
  };
  league: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<Frontend2DB>> | null = null;

export const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<Frontend2DB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('baseData')) {
          db.createObjectStore('baseData', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('league')) {
          db.createObjectStore('league', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
};
