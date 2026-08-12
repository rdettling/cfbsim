import { ROUTES } from '../../constants/routes';
import { normalizeRivalriesData } from '../rivalryData';
import { getDb } from '../../db/db';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from '../../db/leagueRepo';
import {
  abortTransaction,
  assertCurrentRecruitingState,
  RECRUITING_KEY,
  toRecruitingRecord,
} from '../../db/recruitingRepo';
import type { PlayerRecord } from '../../types/db';
import type { LeagueState } from '../../types/league';
import type {
  RecruitingState,
} from '../../types/recruiting';
import { validateNamesData, validateTeamsData } from '../baseDataValidation';
import {
  type FinalizeRosterResult,
  type RosterFinalizationCommandGuard,
  RosterFinalizationConflictError,
  type RosterFinalizationCursor,
  RosterFinalizationRuleError,
} from '../../types/roster';
import { buildOddsContext } from '../odds';
import { createSeededRandom } from '../utils/random';
import {
  applyRosterCutIds,
  assertFinalRosters,
  recommendRosterCuts,
  requiredRosterCuts,
  validateRosterCutSelection,
} from '../rosterCuts';
import { recalculateTeamRatings, setStarters } from '../rosterRatings';
import { POSITION_ORDER, ROSTER } from '../rosterConfig';
import { generateWalkOns } from '../walkOns';
import {
  prepareSeasonReset,
} from './seasonReset';

const LEAGUE_KEY = 'current';

const requireLeague = (
  record: { value: unknown } | undefined,
): LeagueState => {
  if (!record) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  assertCurrentLeagueState(record.value);
  return record.value;
};

const requireRecruiting = (
  record: { value: RecruitingState } | undefined,
) => {
  if (!record) {
    throw new RosterFinalizationConflictError(
      'STATE_MISSING',
      RECRUITING_KEY,
      null,
    );
  }
  assertCurrentRecruitingState(record.value);
  return record.value;
};

const userTeamId = (league: LeagueState) => {
  const team = league.teams.find(candidate => candidate.name === league.info.team);
  if (!team) {
    throw new Error(
      `The user team ${league.info.team} is not in the persisted league.`,
    );
  }
  return team.id;
};

const assertFinalizedState = (
  league: LeagueState,
  state: RecruitingState,
  expectedYear: number,
) => {
  if (
    league.info.currentYear !== expectedYear ||
    state.year !== expectedYear
  ) {
    throw new RosterFinalizationConflictError(
      'YEAR_MISMATCH',
      expectedYear,
      `${league.info.currentYear}/${state.year}`,
    );
  }
  if (state.round !== 6) {
    throw new RosterFinalizationConflictError(
      'ROUND_MISMATCH',
      6,
      state.round,
    );
  }
  if (state.status !== 'finalized') {
    throw new RosterFinalizationConflictError(
      'STATUS_MISMATCH',
      'finalized',
      state.status,
    );
  }
};

const assertGuard = (
  league: LeagueState,
  state: RecruitingState,
  guard: RosterFinalizationCommandGuard,
) => {
  if (league.info.stage !== guard.expectedStage) {
    throw new RosterFinalizationConflictError(
      'STAGE_MISMATCH',
      guard.expectedStage,
      league.info.stage,
    );
  }
  assertFinalizedState(league, state, guard.expectedYear);
  if (state.round !== guard.expectedRound) {
    throw new RosterFinalizationConflictError(
      'ROUND_MISMATCH',
      guard.expectedRound,
      state.round,
    );
  }
  if (state.status !== guard.expectedStatus) {
    throw new RosterFinalizationConflictError(
      'STATUS_MISMATCH',
      guard.expectedStatus,
      state.status,
    );
  }
  if (state.version !== guard.expectedVersion) {
    throw new RosterFinalizationConflictError(
      'VERSION_MISMATCH',
      guard.expectedVersion,
      state.version,
    );
  }
};

const cursor = (
  state: RecruitingState,
  players: PlayerRecord[],
  teamId: number,
): RosterFinalizationCursor => {
  const requiredCuts = requiredRosterCuts(players, teamId);
  return {
    stage: 'roster_cuts',
    year: state.year,
    round: 6,
    status: 'finalized',
    version: state.version,
    pendingUserCutIds: [...state.pendingUserCutIds],
    requiredCuts,
    route: ROUTES.ROSTER_CUTS,
  };
};

const assertStarterAssignments = (
  league: LeagueState,
  players: PlayerRecord[],
) => {
  for (const team of league.teams) {
    for (const position of POSITION_ORDER) {
      const starters = players.filter(
        player =>
          player.starter &&
          player.teamId === team.id &&
          player.pos === position,
      ).length;
      if (starters !== ROSTER[position].starters) {
        throw new RosterFinalizationRuleError(
          'STARTER_MINIMUM',
          `Team ${team.id} has ${starters} starters at ${position}.`,
          undefined,
          team.id,
        );
      }
    }
  }
};

export const initializeRosterFinalization = async ({
  expectedStage,
  expectedYear,
}: {
  expectedStage: 'recruiting_summary';
  expectedYear: number;
}): Promise<{
  previousStage: 'recruiting_summary';
  currentStage: 'roster_cuts';
  route: string;
}> => {
  const db = await getDb();
  const tx = db.transaction(
    ['baseData', 'league', 'recruiting', 'players', 'playerOrigins'],
    'readwrite',
  );
  try {
    const [leagueRecord, recruitingRecord, namesRecord, players] =
      await Promise.all([
        tx.objectStore('league').get(LEAGUE_KEY),
        tx.objectStore('recruiting').get(RECRUITING_KEY),
        tx.objectStore('baseData').get('names'),
        tx.objectStore('players').getAll(),
      ]);
    const league = requireLeague(leagueRecord);
    if (league.info.stage !== expectedStage) {
      throw new RosterFinalizationConflictError(
        'STAGE_MISMATCH',
        expectedStage,
        league.info.stage,
      );
    }
    const state = requireRecruiting(recruitingRecord);
    assertFinalizedState(league, state, expectedYear);
    if (state.pendingUserCutIds.length) {
      throw new RosterFinalizationRuleError(
        'CUT_COUNT_EXCEEDED',
        'Roster-cut selections must be empty before entering roster cuts.',
      );
    }
    if (!namesRecord) {
      throw new Error(
        'Walk-on name data is unavailable. Start a new league to rebuild the base-data cache.',
      );
    }
    assertCurrentRosterState(league, players);
    const generated = generateWalkOns({
      teams: league.teams,
      players,
      names: validateNamesData(namesRecord.value, 'cached names'),
      year: expectedYear,
      seed: state.seed,
      nextPlayerId: league.idCounters.player,
    });
    const playerStore = tx.objectStore('players');
    for (const player of generated.players) {
      await playerStore.add(player);
    }
    const originStore = tx.objectStore('playerOrigins');
    for (const origin of generated.origins) {
      await originStore.add(origin);
    }
    league.idCounters.player = generated.nextPlayerId;
    league.info.stage = 'roster_cuts';
    state.version += 1;
    await tx.objectStore('recruiting').put(toRecruitingRecord(state));
    await tx.objectStore('league').put({ key: LEAGUE_KEY, value: league });
    await tx.done;
    return {
      previousStage: 'recruiting_summary',
      currentStage: 'roster_cuts',
      route: ROUTES.ROSTER_CUTS,
    };
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

const mutateUserCuts = async (
  guard: RosterFinalizationCommandGuard,
  playerId: number,
  operation: 'select' | 'undo',
): Promise<RosterFinalizationCursor> => {
  const db = await getDb();
  const tx = db.transaction(['league', 'recruiting', 'players'], 'readwrite');
  try {
    const [leagueRecord, recruitingRecord, players] = await Promise.all([
      tx.objectStore('league').get(LEAGUE_KEY),
      tx.objectStore('recruiting').get(RECRUITING_KEY),
      tx.objectStore('players').getAll(),
    ]);
    const league = requireLeague(leagueRecord);
    const state = requireRecruiting(recruitingRecord);
    assertGuard(league, state, guard);
    assertCurrentRosterState(league, players);
    const teamId = userTeamId(league);
    const selected = [...state.pendingUserCutIds];
    const index = selected.indexOf(playerId);
    if (operation === 'select') {
      if (index !== -1) {
        throw new RosterFinalizationRuleError(
          'DUPLICATE_CUT',
          `Player ${playerId} is already selected.`,
          playerId,
          teamId,
        );
      }
      selected.push(playerId);
    } else {
      if (index === -1) {
        throw new RosterFinalizationRuleError(
          'CUT_NOT_SELECTED',
          `Player ${playerId} is not selected.`,
          playerId,
          teamId,
        );
      }
      selected.splice(index, 1);
    }
    validateRosterCutSelection(players, teamId, selected);
    state.pendingUserCutIds = selected;
    state.version += 1;
    await tx.objectStore('recruiting').put(toRecruitingRecord(state));
    await tx.done;
    return cursor(state, players, teamId);
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const selectRosterCut = (
  guard: RosterFinalizationCommandGuard,
  playerId: number,
) => mutateUserCuts(guard, playerId, 'select');

export const undoRosterCut = (
  guard: RosterFinalizationCommandGuard,
  playerId: number,
) => mutateUserCuts(guard, playerId, 'undo');

export const finalizeRoster = async (
  guard: RosterFinalizationCommandGuard,
): Promise<FinalizeRosterResult> => {
  const db = await getDb();
  const stores = [
    'baseData',
    'league',
    'recruiting',
    'players',
    'games',
    'playerSeasons',
    'historicalPlayers',
    'seasonMemories',
    'playerOrigins',
  ] as const;
  const tx = db.transaction([...stores], 'readwrite');
  try {
    const [
      leagueRecord,
      recruitingRecord,
      players,
      rivalriesRecord,
      teamsRecord,
      oddsRecord,
    ] = await Promise.all([
      tx.objectStore('league').get(LEAGUE_KEY),
      tx.objectStore('recruiting').get(RECRUITING_KEY),
      tx.objectStore('players').getAll(),
      tx.objectStore('baseData').get('rivalries'),
      tx.objectStore('baseData').get('teams'),
      tx.objectStore('baseData').get('betting_odds'),
    ]);
    const league = requireLeague(leagueRecord);
    const state = requireRecruiting(recruitingRecord);
    assertGuard(league, state, guard);
    assertCurrentRosterState(league, players);
    if (!rivalriesRecord || !teamsRecord || !oddsRecord) {
      throw new Error(
        'Season reset data is unavailable. Start a new league to rebuild the base-data cache.',
      );
    }
    const humanTeamId = userTeamId(league);
    validateRosterCutSelection(
      players,
      humanTeamId,
      state.pendingUserCutIds,
    );
    const humanCutIds = [
      ...state.pendingUserCutIds,
      ...recommendRosterCuts({
        players,
        teamId: humanTeamId,
        year: state.year,
        seed: state.seed,
        selectedCutIds: state.pendingUserCutIds,
      }).map(player => player.id),
    ];
    validateRosterCutSelection(players, humanTeamId, humanCutIds, true);
    const cutIds = [...humanCutIds];
    for (const team of [...league.teams].sort(
      (left, right) => left.id - right.id,
    )) {
      if (team.id === humanTeamId) continue;
      cutIds.push(
        ...recommendRosterCuts({
          players,
          teamId: team.id,
          year: state.year,
          seed: state.seed,
          selectedCutIds: [],
        }).map(player => player.id),
      );
    }
    const freshmen = new Set(
      players.filter(player => player.year === 'fr').map(player => player.id),
    );
    if (cutIds.some(id => freshmen.has(id))) {
      throw new RosterFinalizationRuleError(
        'FRESHMAN_PROTECTED',
        'Finalization attempted to cut a protected freshman.',
      );
    }
    const cutPlayers = players.filter(player => cutIds.includes(player.id));
    applyRosterCutIds(players, cutIds);
    assertFinalRosters(league.teams, players);
    setStarters(league.teams, players);
    assertStarterAssignments(league, players);
    const random = createSeededRandom(state.seed).fork(
      `roster-finalization:${state.year}`,
    );
    recalculateTeamRatings(
      league.teams,
      players,
      random.fork('team-ratings'),
    );
    const reset = await prepareSeasonReset(league, {
      rivalries: normalizeRivalriesData(
        rivalriesRecord.value,
        new Set(Object.keys(validateTeamsData(teamsRecord.value, 'cached teams').teams)),
      ),
      odds: buildOddsContext(oddsRecord.value),
      random: random.fork('season-reset'),
    });
    league.info.stage = 'preseason';

    const playerStore = tx.objectStore('players');
    const historicalStore = tx.objectStore('historicalPlayers');
    const playerSeasonStore = tx.objectStore('playerSeasons');
    const originStore = tx.objectStore('playerOrigins');
    const memories = await tx.objectStore('seasonMemories').getAll();
    const honoredIds = new Set(
      memories.flatMap(memory => memory.awards.map(award => award.playerId)),
    );
    for (const player of cutPlayers) {
      const hasSeason = Boolean(
        await playerSeasonStore.index('playerId').getKey(player.id),
      );
      if (hasSeason || honoredIds.has(player.id)) {
        await historicalStore.put({
          id: player.id,
          first: player.first,
          last: player.last,
          pos: player.pos,
          stars: player.stars,
          development_trait: player.development_trait,
        });
      } else {
        await originStore.delete(player.id);
      }
      await playerStore.delete(player.id);
    }
    for (const player of players) {
      await playerStore.put(player);
    }
    const gameStore = tx.objectStore('games');
    for (const game of reset.gamesToSave) {
      await gameStore.put(game);
    }
    await tx.objectStore('league').put({ key: LEAGUE_KEY, value: league });
    await tx.objectStore('recruiting').delete(RECRUITING_KEY);
    await tx.done;
    return {
      previousStage: 'roster_cuts',
      currentStage: 'preseason',
      route: ROUTES.NONCON,
    };
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};
