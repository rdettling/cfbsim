import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { GameRecord, DriveRecord, PlayRecord, GameLogRecord, PlayerRecord } from '../types/db';
import type { RecruitingState } from '../types/recruiting';

export const DB_NAME = 'cfbsim';
export const DB_VERSION = 2;

export interface Frontend2DB extends DBSchema {
  baseData: {
    key: string;
    value: { key: string; value: unknown };
  };
  league: {
    key: string;
    value: { key: string; value: unknown };
  };
  recruiting: {
    key: string;
    value: { key: string; value: RecruitingState };
  };
  games: {
    key: number;
    value: GameRecord;
    indexes: {
      weekPlayed: number;
      teamAId: number;
      teamBId: number;
      winnerId: number;
    };
  };
  drives: {
    key: number;
    value: DriveRecord;
    indexes: { gameId: number };
  };
  plays: {
    key: number;
    value: PlayRecord;
    indexes: { gameId: number; driveId: number };
  };
  gameLogs: {
    key: number;
    value: GameLogRecord;
    indexes: { gameId: number; playerId: number };
  };
  players: {
    key: number;
    value: PlayerRecord;
    indexes: { teamId: number; pos: string };
  };
}

let dbPromise: Promise<IDBPDatabase<Frontend2DB>> | null = null;

export const upgradeDatabase = (db: IDBPDatabase<Frontend2DB>) => {
  if (!db.objectStoreNames.contains('baseData')) {
    db.createObjectStore('baseData', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('league')) {
    db.createObjectStore('league', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('recruiting')) {
    db.createObjectStore('recruiting', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('games')) {
    const store = db.createObjectStore('games', { keyPath: 'id' });
    store.createIndex('weekPlayed', 'weekPlayed');
    store.createIndex('teamAId', 'teamAId');
    store.createIndex('teamBId', 'teamBId');
    store.createIndex('winnerId', 'winnerId');
  }
  if (!db.objectStoreNames.contains('drives')) {
    const store = db.createObjectStore('drives', { keyPath: 'id' });
    store.createIndex('gameId', 'gameId');
  }
  if (!db.objectStoreNames.contains('plays')) {
    const store = db.createObjectStore('plays', { keyPath: 'id' });
    store.createIndex('gameId', 'gameId');
    store.createIndex('driveId', 'driveId');
  }
  if (!db.objectStoreNames.contains('gameLogs')) {
    const store = db.createObjectStore('gameLogs', { keyPath: 'id' });
    store.createIndex('gameId', 'gameId');
    store.createIndex('playerId', 'playerId');
  }
  if (!db.objectStoreNames.contains('players')) {
    const store = db.createObjectStore('players', { keyPath: 'id' });
    store.createIndex('teamId', 'teamId');
    store.createIndex('pos', 'pos');
  }
};

export const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<Frontend2DB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        upgradeDatabase(db);
      },
    });
  }
  return dbPromise;
};
