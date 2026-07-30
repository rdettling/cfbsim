import type { GameRecord, PlayerOrigin, PlayerRecord } from '../types/db';
import type { LeagueState } from '../types/league';
import { getDb } from './db';

const LEAGUE_KEY = 'current';

export interface NewLeagueCommit {
  league: LeagueState;
  players: PlayerRecord[];
  games: GameRecord[];
  playerOrigins: PlayerOrigin[];
}

export const commitNewLeague = async ({
  league,
  players,
  games,
  playerOrigins,
}: NewLeagueCommit): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(
    [
      'league',
      'recruiting',
      'games',
      'gameDetails',
      'players',
      'seasonMemories',
      'playerSeasons',
      'historicalPlayers',
      'playerOrigins',
    ],
    'readwrite',
  );

  try {
    await Promise.all([
      tx.objectStore('games').clear(),
      tx.objectStore('gameDetails').clear(),
      tx.objectStore('players').clear(),
      tx.objectStore('recruiting').clear(),
      tx.objectStore('seasonMemories').clear(),
      tx.objectStore('playerSeasons').clear(),
      tx.objectStore('historicalPlayers').clear(),
      tx.objectStore('playerOrigins').clear(),
    ]);

    const playerStore = tx.objectStore('players');
    for (const player of players) {
      await playerStore.put(player);
    }
    const originStore = tx.objectStore('playerOrigins');
    for (const origin of playerOrigins) {
      await originStore.put(origin);
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
