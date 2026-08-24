import { deleteDB, openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type {
  GameDetailRecord,
  GameRecord,
  HistoricalPlayerRecord,
  PlayerOrigin,
  PlayerRecord,
  PlayerSeasonStats,
} from '../types/db';
import type { RecruitingState } from '../types/recruiting';
import type { SeasonMemory } from '../types/memory';
import type { NewsItem } from '../types/news';

export const DB_NAME = 'cfbsim';
export const DB_VERSION = 33;

export interface CfbSimDB extends DBSchema {
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
      year: number;
      weekPlayed: number;
      teamAId: number;
      teamBId: number;
      winnerId: number;
    };
  };
  newsItems: {
    key: string;
    value: NewsItem;
    indexes: {
      year: number;
      yearWeek: [number, number];
      gameId: number;
    };
  };
  gameDetails: {
    key: number;
    value: GameDetailRecord;
    indexes: { year: number };
  };
  players: {
    key: number;
    value: PlayerRecord;
    indexes: { teamId: number; pos: string };
  };
  seasonMemories: {
    key: number;
    value: SeasonMemory;
  };
  playerSeasons: {
    key: [number, number];
    value: PlayerSeasonStats;
    indexes: {
      playerId: number;
      year: number;
      teamId: number;
      yearTeamId: [number, number];
    };
  };
  historicalPlayers: {
    key: number;
    value: HistoricalPlayerRecord;
  };
  playerOrigins: {
    key: number;
    value: PlayerOrigin;
  };
}

let dbPromise: Promise<IDBPDatabase<CfbSimDB>> | null = null;

type CurrentStoreName =
  | 'baseData'
  | 'league'
  | 'recruiting'
  | 'games'
  | 'newsItems'
  | 'gameDetails'
  | 'players'
  | 'seasonMemories'
  | 'playerSeasons'
  | 'historicalPlayers'
  | 'playerOrigins';

const createCurrentSchema = (db: IDBPDatabase<CfbSimDB>) => {
  db.createObjectStore('baseData', { keyPath: 'key' });
  db.createObjectStore('league', { keyPath: 'key' });
  db.createObjectStore('recruiting', { keyPath: 'key' });

  const games = db.createObjectStore('games', { keyPath: 'id' });
  games.createIndex('year', 'year');
  games.createIndex('weekPlayed', 'weekPlayed');
  games.createIndex('teamAId', 'teamAId');
  games.createIndex('teamBId', 'teamBId');
  games.createIndex('winnerId', 'winnerId');

  const gameDetails = db.createObjectStore('gameDetails', { keyPath: 'gameId' });
  gameDetails.createIndex('year', 'year');

  const newsItems = db.createObjectStore('newsItems', { keyPath: 'id' });
  newsItems.createIndex('year', 'year');
  newsItems.createIndex('yearWeek', ['year', 'week']);
  newsItems.createIndex('gameId', 'gameId');

  const players = db.createObjectStore('players', { keyPath: 'id' });
  players.createIndex('teamId', 'teamId');
  players.createIndex('pos', 'pos');

  db.createObjectStore('seasonMemories', { keyPath: 'year' });

  const playerSeasons = db.createObjectStore('playerSeasons', {
    keyPath: ['year', 'playerId'],
  });
  playerSeasons.createIndex('playerId', 'playerId');
  playerSeasons.createIndex('year', 'year');
  playerSeasons.createIndex('teamId', 'teamId');
  playerSeasons.createIndex('yearTeamId', ['year', 'teamId']);

  db.createObjectStore('historicalPlayers', { keyPath: 'id' });
  db.createObjectStore('playerOrigins', { keyPath: 'playerId' });
};

export const upgradeDatabase = (
  db: IDBPDatabase<CfbSimDB>,
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
    const opening = openDB<CfbSimDB>(DB_NAME, DB_VERSION, {
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
