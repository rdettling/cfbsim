import type { HistoryData } from '../types/baseData';
import type { GameRecord, PlayerRecord } from '../types/db';
import type { OffseasonStage } from '../types/domain';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type LeagueState,
} from '../types/league';
import type { Settings } from '../types/domain';
import { getDb } from './db';

const LEAGUE_KEY = 'current';

export interface OffseasonTransitionCommit {
  expectedStage: OffseasonStage;
  expectedSettings?: Settings;
  league: LeagueState;
  history?: HistoryData;
  players?: PlayerRecord[];
  games?: GameRecord[];
  clearNonGameArtifacts?: boolean;
}

export const commitOffseasonTransition = async ({
  expectedStage,
  expectedSettings,
  league,
  history,
  players,
  games,
  clearNonGameArtifacts = false,
}: OffseasonTransitionCommit) => {
  const db = await getDb();
  const tx = db.transaction(
    ['baseData', 'league', 'players', 'games', 'drives', 'plays', 'gameLogs'],
    'readwrite',
  );

  try {
    const persisted = await tx.objectStore('league').get(LEAGUE_KEY);
    const persistedLeague = persisted?.value as LeagueState | undefined;
    if (!persistedLeague) {
      throw new Error('No league found. Start a new game from the Home page.');
    }

    if (persistedLeague.info.stage !== expectedStage) {
      throw new OffseasonStageMismatchError(
        expectedStage,
        persistedLeague.info.stage,
      );
    }

    if (
      expectedSettings &&
      JSON.stringify(persistedLeague.settings) !== JSON.stringify(expectedSettings)
    ) {
      throw new OffseasonConfigurationConflictError();
    }

    if (history) {
      await tx.objectStore('baseData').put({
        key: 'history',
        value: history,
      });
    }

    if (clearNonGameArtifacts) {
      await Promise.all([
        tx.objectStore('drives').clear(),
        tx.objectStore('plays').clear(),
        tx.objectStore('gameLogs').clear(),
      ]);
    }

    if (players) {
      const playerStore = tx.objectStore('players');
      for (const player of players) {
        await playerStore.put(player);
      }
    }

    if (games) {
      const gameStore = tx.objectStore('games');
      for (const game of games) {
        await gameStore.put(game);
      }
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
