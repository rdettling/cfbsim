import type { GameRecord, PlayerRecord } from '../types/db';
import type { LeagueState } from '../types/league';
import { getDb } from './db';

const LEAGUE_KEY = 'current';

export interface NewLeagueCommit {
  league: LeagueState;
  players: PlayerRecord[];
  games: GameRecord[];
}

export const commitNewLeague = async ({
  league,
  players,
  games,
}: NewLeagueCommit): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'recruiting', 'games', 'drives', 'plays', 'gameLogs', 'players'],
    'readwrite',
  );

  try {
    await Promise.all([
      tx.objectStore('games').clear(),
      tx.objectStore('drives').clear(),
      tx.objectStore('plays').clear(),
      tx.objectStore('gameLogs').clear(),
      tx.objectStore('players').clear(),
      tx.objectStore('recruiting').clear(),
    ]);

    const playerStore = tx.objectStore('players');
    for (const player of players) {
      await playerStore.put(player);
    }

    const gameStore = tx.objectStore('games');
    for (const game of games) {
      await gameStore.put(game);
    }

    await tx.objectStore('league').put({
      key: LEAGUE_KEY,
      value: league,
    });
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have aborted because of a failed request.
    }
    try {
      await tx.done;
    } catch {
      // The explicit abort is expected.
    }
    throw error;
  }
};
