import type { HistoryData } from '../types/baseData';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type OffseasonAdvanceStage,
  type LeagueState,
} from '../types/league';
import type { NextSeasonConfiguration } from '../types/domain';
import type { SeasonMemory } from '../types/memory';
import type { PlayerSeasonStats } from '../types/db';
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
  memory?: SeasonMemory;
  playerSeasons?: PlayerSeasonStats[];
  retainedGameIds?: Set<number>;
}

export const commitOffseasonTransition = async ({
  expectedStage,
  expectedSettings,
  league,
  history,
  memory,
  playerSeasons,
  retainedGameIds,
}: OffseasonTransitionCommit) => {
  const db = await getDb();
  const tx = db.transaction(
    ['baseData', 'league', 'seasonMemories', 'playerSeasons', 'gameDetails'],
    'readwrite',
  );

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

    if (memory) {
      const existing = await tx.objectStore('seasonMemories').get(memory.year);
      if (existing) {
        throw new Error(`Dynasty memory for ${memory.year} already exists.`);
      }
      await tx.objectStore('seasonMemories').put(memory);
    }

    if (playerSeasons) {
      const store = tx.objectStore('playerSeasons');
      for (const season of playerSeasons) {
        if (await store.get([season.year, season.playerId])) {
          throw new Error(
            `Player season ${season.year}/${season.playerId} already exists.`,
          );
        }
        await store.put(season);
      }
    }

    if (memory && retainedGameIds) {
      const detailStore = tx.objectStore('gameDetails');
      const keys = await detailStore.index('year').getAllKeys(memory.year);
      for (const key of keys) {
        if (!retainedGameIds.has(Number(key))) await detailStore.delete(key);
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
