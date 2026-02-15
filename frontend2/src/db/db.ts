import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export const DB_NAME = 'cfbsim_frontend2';
export const DB_VERSION = 2;

export interface GameRecord {
  id: number;
  teamAId: number;
  teamBId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  neutralSite: boolean;
  winnerId: number | null;
  baseLabel: string;
  name: string | null;
  spreadA: string;
  spreadB: string;
  moneylineA: string;
  moneylineB: string;
  winProbA: number;
  winProbB: number;
  weekPlayed: number;
  year: number;
  rankATOG: number;
  rankBTOG: number;
  resultA: string | null;
  resultB: string | null;
  overtime: number;
  scoreA: number | null;
  scoreB: number | null;
  headline: string | null;
  watchability: number | null;
}

export interface DriveRecord {
  id: number;
  gameId: number;
  driveNum: number;
  offenseId: number;
  defenseId: number;
  startingFP: number;
  result: string;
  points: number;
  points_needed: number;
  scoreAAfter: number;
  scoreBAfter: number;
}

export interface PlayRecord {
  id: number;
  gameId: number;
  driveId: number;
  offenseId: number;
  defenseId: number;
  startingFP: number;
  down: number;
  yardsLeft: number;
  playType: string;
  yardsGained: number;
  result: string;
  text: string;
  header: string;
  scoreA: number;
  scoreB: number;
}

export interface GameLogRecord {
  id: number;
  playerId: number;
  gameId: number;
  pass_yards: number;
  pass_attempts: number;
  pass_completions: number;
  pass_touchdowns: number;
  pass_interceptions: number;
  rush_yards: number;
  rush_attempts: number;
  rush_touchdowns: number;
  receiving_yards: number;
  receiving_catches: number;
  receiving_touchdowns: number;
  fumbles: number;
  tackles: number;
  sacks: number;
  interceptions: number;
  fumbles_forced: number;
  fumbles_recovered: number;
  field_goals_made: number;
  field_goals_attempted: number;
  extra_points_made: number;
  extra_points_attempted: number;
}

export interface PlayerRecord {
  id: number;
  teamId: number;
  first: string;
  last: string;
  pos: string;
  rating: number;
  starter: boolean;
}

export interface Frontend2DB extends DBSchema {
  baseData: {
    key: string;
    value: { key: string; value: unknown };
  };
  league: {
    key: string;
    value: { key: string; value: unknown };
  };
  games: {
    key: number;
    value: GameRecord;
    indexes: {
      weekPlayed: number;
      teamAId: number;
      teamBId: number;
      winnerId: number | null;
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
    indexes: { teamId: number; pos: string; starter: boolean };
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
          store.createIndex('starter', 'starter');
        }
      },
    });
  }
  return dbPromise;
};
