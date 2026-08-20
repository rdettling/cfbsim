import type { LeagueState } from '../types/league';
import { getDb } from './db';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from './leagueStateValidation';

const LEAGUE_KEY = 'current';

export const loadLeague = async (): Promise<LeagueState | null> => {
  const db = await getDb();
  const record = await db.get('league', LEAGUE_KEY);
  if (!record) return null;
  assertCurrentLeagueState(record.value);
  return record.value;
};

export const saveLeague = async (league: LeagueState): Promise<void> => {
  assertCurrentLeagueState(league);
  const db = await getDb();
  await db.put('league', { key: LEAGUE_KEY, value: league });
};

export const requireCurrentRoster = async (league: LeagueState) => {
  const db = await getDb();
  const players = await db.getAll('players');
  assertCurrentRosterState(league, players);
  return players;
};

export const loadLeaguePlayersSnapshot = async () => {
  const db = await getDb();
  const tx = db.transaction(['league', 'players'], 'readonly');
  const [record, players] = await Promise.all([
    tx.objectStore('league').get(LEAGUE_KEY),
    tx.objectStore('players').getAll(),
  ]);
  await tx.done;
  if (!record) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  assertCurrentLeagueState(record.value);
  assertCurrentRosterState(record.value, players);
  return { league: record.value, players };
};
