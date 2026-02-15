import { deleteDB, openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import {
  CFBSimDB,
  DB_NAME,
  DB_VERSION,
  EXPECTED_STORES,
  STORE_NAMES,
} from './schema';

const hasExpectedStores = (db: IDBPDatabase<CFBSimDB>): boolean => {
  return EXPECTED_STORES.every(store => db.objectStoreNames.contains(store));
};

const createSchema = (db: IDBPDatabase<CFBSimDB>) => {
  db.createObjectStore(STORE_NAMES.info, { keyPath: 'user_id' });

  const settings = db.createObjectStore(STORE_NAMES.settings, {
    keyPath: 'id',
    autoIncrement: true,
  });
  settings.createIndex('infoId', 'info_id', { unique: true });

  db.createObjectStore(STORE_NAMES.teams, {
    keyPath: 'id',
    autoIncrement: true,
  });

  const players = db.createObjectStore(STORE_NAMES.players, {
    keyPath: 'id',
    autoIncrement: true,
  });
  players.createIndex('teamIdPosRating', ['team_id', 'pos', 'rating']);
  players.createIndex('teamIdPosActive', ['team_id', 'pos', 'active']);
  players.createIndex('activePos', ['active', 'pos']);

  db.createObjectStore(STORE_NAMES.games, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.playoff, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.history, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.conferences, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.odds, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.recruits, {
    keyPath: 'id',
    autoIncrement: true,
  });

  const offers = db.createObjectStore(STORE_NAMES.offers, {
    keyPath: 'id',
    autoIncrement: true,
  });
  offers.createIndex('recruitIdTeamId', ['recruit_id', 'team_id'], {
    unique: true,
  });

  const awards = db.createObjectStore(STORE_NAMES.awards, {
    keyPath: 'id',
    autoIncrement: true,
  });
  awards.createIndex('infoIdSlugFinal', ['info_id', 'slug', 'is_final'], {
    unique: true,
  });

  db.createObjectStore(STORE_NAMES.gameLogs, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.drives, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.plays, {
    keyPath: 'id',
    autoIncrement: true,
  });

  db.createObjectStore(STORE_NAMES.baseData, { keyPath: 'key' });
};

export const openDb = async (): Promise<IDBPDatabase<CFBSimDB>> => {
  let db = await openDB<CFBSimDB>(DB_NAME, DB_VERSION, {
    upgrade(upgradeDb) {
      createSchema(upgradeDb);
    },
  });

  if (!hasExpectedStores(db)) {
    db.close();
    await deleteDB(DB_NAME);
    db = await openDB<CFBSimDB>(DB_NAME, DB_VERSION, {
      upgrade(upgradeDb) {
        createSchema(upgradeDb);
      },
    });
  }

  return db;
};
