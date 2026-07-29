import type { HistoryData } from '../types/baseData';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type OffseasonAdvanceStage,
  type LeagueState,
} from '../types/league';
import type { NextSeasonConfiguration } from '../types/domain';
import { getDb } from './db';
import { assertCurrentLeagueState } from './leagueRepo';

const LEAGUE_KEY = 'current';

type GenericOffseasonTransitionStage = Extract<
  OffseasonAdvanceStage,
  'summary' | 'realignment'
>;

export interface OffseasonTransitionCommit {
  expectedStage: GenericOffseasonTransitionStage;
  expectedSettings?: NextSeasonConfiguration;
  league: LeagueState;
  history?: HistoryData;
}

export const commitOffseasonTransition = async ({
  expectedStage,
  expectedSettings,
  league,
  history,
}: OffseasonTransitionCommit) => {
  const db = await getDb();
  const tx = db.transaction(['baseData', 'league'], 'readwrite');

  try {
    const persisted = await tx.objectStore('league').get(LEAGUE_KEY);
    if (!persisted) {
      throw new Error('No league found. Start a new game from the Home page.');
    }
    assertCurrentLeagueState(persisted.value);
    const persistedLeague = persisted.value;

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
