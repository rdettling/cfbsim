import { deleteDB, openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { GameRecord, DriveRecord, PlayRecord, GameLogRecord, PlayerRecord } from '../types/db';
import type { RecruitingState } from '../types/recruiting';

export const DB_NAME = 'cfbsim';
export const DB_VERSION = 3;

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

type CurrentStoreName =
  | 'baseData'
  | 'league'
  | 'recruiting'
  | 'games'
  | 'drives'
  | 'plays'
  | 'gameLogs'
  | 'players';

const createCurrentSchema = (db: IDBPDatabase<Frontend2DB>) => {
  db.createObjectStore('baseData', { keyPath: 'key' });
  db.createObjectStore('league', { keyPath: 'key' });
  db.createObjectStore('recruiting', { keyPath: 'key' });

  const games = db.createObjectStore('games', { keyPath: 'id' });
  games.createIndex('weekPlayed', 'weekPlayed');
  games.createIndex('teamAId', 'teamAId');
  games.createIndex('teamBId', 'teamBId');
  games.createIndex('winnerId', 'winnerId');

  const drives = db.createObjectStore('drives', { keyPath: 'id' });
  drives.createIndex('gameId', 'gameId');

  const plays = db.createObjectStore('plays', { keyPath: 'id' });
  plays.createIndex('gameId', 'gameId');
  plays.createIndex('driveId', 'driveId');

  const gameLogs = db.createObjectStore('gameLogs', { keyPath: 'id' });
  gameLogs.createIndex('gameId', 'gameId');
  gameLogs.createIndex('playerId', 'playerId');

  const players = db.createObjectStore('players', { keyPath: 'id' });
  players.createIndex('teamId', 'teamId');
  players.createIndex('pos', 'pos');
};

export const upgradeDatabase = (
  db: IDBPDatabase<Frontend2DB>,
  oldVersion: number,
) => {
  if (oldVersion > 0) {
    for (const storeName of Array.from(db.objectStoreNames)) {
      db.deleteObjectStore(storeName as CurrentStoreName);
    }
  }
  createCurrentSchema(db);
};

export const getDb = () => {
  if (!dbPromise) {
    const opening = openDB<Frontend2DB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        upgradeDatabase(db, oldVersion);
      },
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase).close();
        if (dbPromise === opening) dbPromise = null;
      },
      terminated() {
        if (dbPromise === opening) dbPromise = null;
      },
    });
    dbPromise = opening;
  }
  return dbPromise;
};

export const deleteCurrentDatabase = async () => {
  const opening = dbPromise;
  dbPromise = null;
  if (opening) {
    const db = await opening.catch(() => null);
    db?.close();
  }
  await deleteDB(DB_NAME);
};
