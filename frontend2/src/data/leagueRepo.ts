import { getDb } from './db';

const LEAGUE_KEY = 'current';

export const loadLeague = async <T>(): Promise<T | null> => {
  const db = await getDb();
  const record = await db.get('league', LEAGUE_KEY);
  return (record?.value as T) ?? null;
};

export const saveLeague = async <T>(league: T): Promise<void> => {
  const db = await getDb();
  await db.put('league', { key: LEAGUE_KEY, value: league });
};

export const clearLeague = async (): Promise<void> => {
  const db = await getDb();
  await db.delete('league', LEAGUE_KEY);
};
