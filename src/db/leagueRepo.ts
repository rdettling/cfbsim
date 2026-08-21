import type { LeagueState } from '../types/league';
import type { PlayerRecord } from '../types/db';
import { getDb } from './db';
import {
  assertCurrentLeagueState,
  assertCurrentPlayerRecords,
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

export const getPlayersByIds = async (
  league: LeagueState,
  playerIds: number[],
) => {
  const ids = [...new Set(playerIds)];
  if (!ids.length) return [];
  const db = await getDb();
  const tx = db.transaction('players', 'readonly');
  const players = await Promise.all(
    ids.map(playerId => tx.objectStore('players').get(playerId)),
  );
  await tx.done;
  if (players.some(player => player === undefined)) {
    throw new Error('Finalized awards reference a missing current player.');
  }
  const resolved = players as PlayerRecord[];
  assertCurrentPlayerRecords(league, resolved);
  return resolved;
};
