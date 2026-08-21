import type { HistoryData } from '../types/baseData';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type OffseasonAdvanceStage,
  type LeagueState,
} from '../types/league';
import type { NextSeasonConfiguration } from '../types/domain';
import type { PlayerOrigin, PlayerRecord } from '../types/db';
import { getDb } from './db';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from './leagueStateValidation';
import { isPlayerOrigin } from './playerOriginRepo';

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
  detailPruning?: { year: number; retainedGameIds: Set<number> };
  players?: PlayerRecord[];
  playerOrigins?: PlayerOrigin[];
}

const assertProgramEntryRecords = (
  league: LeagueState,
  players: PlayerRecord[],
  origins: PlayerOrigin[],
) => {
  const playersById = new Map(players.map(player => [player.id, player]));
  const originIds = new Set<number>();
  const invalid =
    players.length !== origins.length ||
    playersById.size !== players.length ||
    origins.some(origin => {
      if (
        !isPlayerOrigin(origin) ||
        origin.kind !== 'program_entry' ||
        originIds.has(origin.playerId)
      ) {
        return true;
      }
      originIds.add(origin.playerId);
      const player = playersById.get(origin.playerId);
      return (
        !player ||
        origin.acquisitionYear !== league.info.currentYear ||
        origin.originalTeamId !== player.teamId ||
        origin.classAtEntry !== player.year
      );
    });
  if (invalid) {
    throw new Error('Program-entry player origins do not match their players.');
  }
};

export const commitOffseasonTransition = async ({
  expectedStage,
  expectedSettings,
  league,
  history,
  detailPruning,
  players,
  playerOrigins,
}: OffseasonTransitionCommit) => {
  if ((players === undefined) !== (playerOrigins === undefined)) {
    throw new Error('Program-entry players and origins must be committed together.');
  }
  const db = await getDb();
  const tx = db.transaction(
    [
      'baseData',
      'league',
      'gameDetails',
      'players',
      'playerOrigins',
    ],
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
      JSON.stringify(persistedLeague.settings) !==
        JSON.stringify(expectedSettings)
    ) {
      throw new OffseasonConfigurationConflictError();
    }

    if (players && playerOrigins) {
      assertProgramEntryRecords(league, players, playerOrigins);
      const persistedPlayers = await tx.objectStore('players').getAll();
      assertCurrentRosterState(persistedLeague, persistedPlayers);
      assertCurrentRosterState(league, [...persistedPlayers, ...players]);

      const playerStore = tx.objectStore('players');
      for (const player of players) await playerStore.add(player);
      const originStore = tx.objectStore('playerOrigins');
      for (const origin of playerOrigins) await originStore.add(origin);
    }

    if (history) {
      await tx.objectStore('baseData').put({
        key: 'history',
        value: history,
      });
    }

    if (detailPruning) {
      const detailStore = tx.objectStore('gameDetails');
      const keys = await detailStore.index('year').getAllKeys(detailPruning.year);
      for (const key of keys) {
        if (!detailPruning.retainedGameIds.has(Number(key))) {
          await detailStore.delete(key);
        }
      }
    }

    assertCurrentLeagueState(league);
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
