import { getDb } from '../../../db/db';
import {
  abortTransaction,
  RECRUITING_KEY,
  toRecruitingRecord,
} from '../../../db/recruitingRepo';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from '../../../db/leagueStateValidation';
import { ROUTES } from '../../../constants/routes';
import type { LeagueState } from '../../../types/league';
import {
  RecruitingConflictError,
  type AdvanceRecruitingRoundInput,
  type CompleteRecruitingWithAiInput,
  type InitializeRecruitingInput,
  type RecruitingCommandCursor,
  type RecruitingCommandGuard,
  type RecruitingCommitmentEvent,
  type RecruitingRoundCommandResult,
  type RecruitingState,
  type UpdateRecruitingBoardInput,
} from '../../../types/recruiting';
import { validateNamesData, validateStatesData } from '../../baseDataValidation';
import { applyProgression } from '../../roster';
import { buildRecruitingContext } from '../../recruiting/context';
import { applyAiRecruitingDecisions } from '../../recruiting/aiRound';
import { buildAiRecruitingSnapshot } from '../../recruiting/aiSnapshot';
import {
  planAiRecruitingDecisions,
  planAssistedRecruitingDecisions,
} from '../../recruiting/aiStrategy';
import { buildCommittedFreshmen } from '../../recruiting/freshmen';
import { generateProspectPool } from '../../recruiting/generation';
import {
  resolveRecruitingRound,
  resolveSigningDay,
} from '../../recruiting/resolution';
import { RecruitingRuleViolationError } from '../../recruiting/rules';
import {
  cloneRecruitingState,
  createTeamRecruitingStates,
  updateRecruitingBoard as updateBoardState,
} from '../../recruiting/state';
import { validateAllocations } from '../../recruiting/validation';
import { generateRandomSeed } from '../../utils/randomSeed';
import { requireRecruitingState } from '../utils/recruitingLifecycleState';

const LEAGUE_KEY = 'current';

const loadLeagueFromRecord = (
  record: { value: unknown } | undefined,
): LeagueState => {
  if (!record) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  assertCurrentLeagueState(record.value);
  return record.value;
};

const assertRecruitingGuard = (
  league: LeagueState,
  state: RecruitingState,
  guard: RecruitingCommandGuard,
) => {
  if (league.info.stage !== guard.expectedStage) {
    throw new RecruitingConflictError(
      'STAGE_MISMATCH',
      guard.expectedStage,
      league.info.stage,
    );
  }
  if (
    league.info.currentYear !== guard.expectedYear ||
    state.year !== guard.expectedYear
  ) {
    throw new RecruitingConflictError(
      'YEAR_MISMATCH',
      guard.expectedYear,
      `${league.info.currentYear}/${state.year}`,
    );
  }
  if (state.round !== guard.expectedRound) {
    throw new RecruitingConflictError(
      'ROUND_MISMATCH',
      guard.expectedRound,
      state.round,
    );
  }
  if (state.version !== guard.expectedVersion) {
    throw new RecruitingConflictError(
      'VERSION_MISMATCH',
      guard.expectedVersion,
      state.version,
    );
  }
};

const loadGuardedRecruitingRecords = (
  leagueRecord: { value: unknown } | undefined,
  recruitingRecord: { value: RecruitingState } | undefined,
  guard: RecruitingCommandGuard,
) => {
  const league = loadLeagueFromRecord(leagueRecord);
  const state = requireRecruitingState(recruitingRecord?.value);
  assertRecruitingGuard(league, state, guard);
  return { league, state };
};

const userTeamId = (league: LeagueState) => {
  const team = league.teams.find(candidate => candidate.name === league.info.team);
  if (!team) {
    throw new Error(`The user team ${league.info.team} is not in the persisted league.`);
  }
  return team.id;
};

const assertStatus = (
  state: RecruitingState,
  expected: RecruitingState['status'],
) => {
  if (state.status !== expected) {
    throw new RecruitingConflictError(
      'STATUS_MISMATCH',
      expected,
      state.status,
    );
  }
};

const cursor = (
  league: LeagueState,
  state: RecruitingState,
  commitments: RecruitingCommitmentEvent[] = [],
): RecruitingCommandCursor => ({
  stage: league.info.stage as RecruitingCommandCursor['stage'],
  year: state.year,
  round: state.round,
  status: state.status,
  version: state.version,
  route:
    league.info.stage === 'recruiting_summary'
      ? ROUTES.RECRUITING_SUMMARY
      : ROUTES.RECRUITING,
  commitments,
});

const asPersistedState = (
  state: Omit<RecruitingState, 'version' | 'pendingUserCutIds'>,
  source: RecruitingState,
): RecruitingState => ({
  ...state,
  version: source.version + 1,
  pendingUserCutIds: [...source.pendingUserCutIds],
});

export const initializeRecruiting = async ({
  expectedStage,
  expectedYear,
  seed = generateRandomSeed(),
}: InitializeRecruitingInput): Promise<RecruitingCommandCursor> => {
  const db = await getDb();
  const tx = db.transaction(
    [
      'baseData',
      'league',
      'players',
      'recruiting',
      'playerSeasons',
      'historicalPlayers',
      'seasonMemories',
      'playerOrigins',
    ],
    'readwrite',
  );

  try {
    const league = loadLeagueFromRecord(
      await tx.objectStore('league').get(LEAGUE_KEY),
    );
    if (league.info.stage !== expectedStage) {
      throw new RecruitingConflictError(
        'STAGE_MISMATCH',
        expectedStage,
        league.info.stage,
      );
    }
    if (league.info.currentYear !== expectedYear) {
      throw new RecruitingConflictError(
        'YEAR_MISMATCH',
        expectedYear,
        league.info.currentYear,
      );
    }
    if (await tx.objectStore('recruiting').get(RECRUITING_KEY)) {
      throw new RecruitingConflictError('STATE_EXISTS', null, RECRUITING_KEY);
    }

    const [namesRecord, statesRecord] = await Promise.all([
      tx.objectStore('baseData').get('names'),
      tx.objectStore('baseData').get('states'),
    ]);
    if (!namesRecord || !statesRecord) {
      throw new Error(
        'Recruiting source data is unavailable. Start a new league to rebuild the base-data cache.',
      );
    }
    const names = validateNamesData(namesRecord.value, 'cached names');
    const states = validateStatesData(statesRecord.value, 'cached states');
    const players = await tx.objectStore('players').getAll();
    assertCurrentRosterState(league, players);
    const departing = players.filter(player => player.year === 'sr');
    applyProgression(players);
    const context = buildRecruitingContext(league.teams, players);
    const state: RecruitingState = {
      year: league.info.currentYear,
      round: 1,
      status: 'active',
      seed: seed >>> 0,
      prospects: generateProspectPool({
        teams: league.teams,
        returningPlayers: players,
        names,
        states,
        year: league.info.currentYear,
        seed: seed >>> 0,
      }),
      teams: createTeamRecruitingStates(league.teams, context),
      version: 1,
      pendingUserCutIds: [],
    };

    const playerStore = tx.objectStore('players');
    const historicalStore = tx.objectStore('historicalPlayers');
    const playerSeasonStore = tx.objectStore('playerSeasons');
    const originStore = tx.objectStore('playerOrigins');
    const memories = await tx.objectStore('seasonMemories').getAll();
    const honoredIds = new Set(
      memories.flatMap(memory => memory.awards.map(award => award.playerId)),
    );
    for (const player of departing) {
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
    await tx.objectStore('recruiting').put(toRecruitingRecord(state));
    league.info.stage = 'recruiting';
    assertCurrentLeagueState(league);
    await tx.objectStore('league').put({ key: LEAGUE_KEY, value: league });
    await tx.done;
    return cursor(league, state);
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const updateRecruitingBoard = async ({
  prospectIds,
  ...guard
}: UpdateRecruitingBoardInput): Promise<RecruitingCommandCursor> => {
  const db = await getDb();
  const tx = db.transaction(['league', 'players', 'recruiting'], 'readwrite');
  try {
    const { league, state } = loadGuardedRecruitingRecords(
      await tx.objectStore('league').get(LEAGUE_KEY),
      await tx.objectStore('recruiting').get(RECRUITING_KEY),
      guard,
    );
    assertStatus(state, 'active');
    const players = await tx.objectStore('players').getAll();
    assertCurrentRosterState(league, players);
    const context = buildRecruitingContext(league.teams, players);
    const result = updateBoardState(
      state,
      userTeamId(league),
      prospectIds,
      context,
    );
    if (result.violations.length) {
      throw new RecruitingRuleViolationError(result.violations);
    }
    const next = asPersistedState(result.state, state);
    await tx.objectStore('recruiting').put(toRecruitingRecord(next));
    await tx.done;
    return cursor(league, next);
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

const planAndResolveRound = (
  state: RecruitingState,
  context: ReturnType<typeof buildRecruitingContext>,
  humanTeamId: number,
  manualAllocations?: Record<number, number>,
) => {
  const teamIds = state.teams.map(team => team.teamId);
  const decisions = manualAllocations
    ? planAssistedRecruitingDecisions(
        buildAiRecruitingSnapshot(state, context),
        teamIds,
        {
          teamId: humanTeamId,
          allocations: manualAllocations,
        },
      )
    : planAiRecruitingDecisions(
        buildAiRecruitingSnapshot(state, context),
        teamIds,
      );
  const prepared = applyAiRecruitingDecisions(
    state,
    decisions,
    context,
  );
  const result = resolveRecruitingRound(
    prepared.state,
    prepared.allocations,
    context,
  );
  return { decisions, result };
};

export const advanceRecruitingRound = async ({
  allocations,
  ...guard
}: AdvanceRecruitingRoundInput): Promise<RecruitingRoundCommandResult> => {
  const db = await getDb();
  const tx = db.transaction(['league', 'players', 'recruiting'], 'readwrite');
  try {
    const { league, state } = loadGuardedRecruitingRecords(
      await tx.objectStore('league').get(LEAGUE_KEY),
      await tx.objectStore('recruiting').get(RECRUITING_KEY),
      guard,
    );
    assertStatus(state, 'active');
    const players = await tx.objectStore('players').getAll();
    assertCurrentRosterState(league, players);
    const context = buildRecruitingContext(league.teams, players);
    const humanTeamId = userTeamId(league);
    const violations = validateAllocations(
      state,
      humanTeamId,
      allocations,
    );
    if (violations.length) {
      throw new RecruitingRuleViolationError(violations);
    }
    const priorBoard = state.teams.find(
      team => team.teamId === humanTeamId,
    )!.board;
    const planned = planAndResolveRound(
      state,
      context,
      humanTeamId,
      allocations,
    );
    const humanDecision = planned.decisions.find(
      decision => decision.teamId === humanTeamId,
    )!;
    const manualPoints = Object.values(allocations).reduce(
      (sum, points) => sum + points,
      0,
    );
    const next = asPersistedState(planned.result.state, state);
    await tx.objectStore('recruiting').put(toRecruitingRecord(next));
    await tx.done;
    return {
      ...cursor(league, next, planned.result.commitments),
      assistance: {
        pointsAdded:
          Object.values(humanDecision.allocations).reduce(
            (sum, points) => sum + points,
            0,
          ) - manualPoints,
        prospectIdsAdded: humanDecision.board.filter(
          prospectId => !priorBoard.includes(prospectId),
        ),
      },
    };
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const completeRecruitingWithAi = async ({
  allocations,
  ...guard
}: CompleteRecruitingWithAiInput): Promise<RecruitingCommandCursor> => {
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'players', 'recruiting', 'playerOrigins'],
    'readwrite',
  );
  try {
    const { league, state } = loadGuardedRecruitingRecords(
      await tx.objectStore('league').get(LEAGUE_KEY),
      await tx.objectStore('recruiting').get(RECRUITING_KEY),
      guard,
    );
    assertStatus(state, 'active');
    const existingPlayers = await tx.objectStore('players').getAll();
    assertCurrentRosterState(league, existingPlayers);
    const context = buildRecruitingContext(league.teams, existingPlayers);
    const humanTeamId = userTeamId(league);
    const violations = validateAllocations(
      state,
      humanTeamId,
      allocations,
    );
    if (violations.length) {
      throw new RecruitingRuleViolationError(violations);
    }

    let working = cloneRecruitingState(state) as RecruitingState;
    const commitments: RecruitingCommitmentEvent[] = [];
    let firstRound = true;
    while (working.status === 'active') {
      const planned = planAndResolveRound(
        working,
        context,
        humanTeamId,
        firstRound ? allocations : undefined,
      );
      working = {
        ...planned.result.state,
        version: state.version,
        pendingUserCutIds: [...state.pendingUserCutIds],
      };
      commitments.push(...planned.result.commitments);
      firstRound = false;
    }

    const signingDay = resolveSigningDay(working, context);
    commitments.push(...signingDay.commitments);
    const next = asPersistedState(signingDay.state, state);
    const freshmen = buildCommittedFreshmen({
      prospects: next.prospects,
      existingPlayers,
      nextPlayerId: league.idCounters.player,
      acquisitionYear: next.year,
    });
    league.idCounters.player = freshmen.nextPlayerId;
    league.info.stage = 'recruiting_summary';

    const playerStore = tx.objectStore('players');
    for (const player of freshmen.players) {
      await playerStore.add(player);
    }
    const originStore = tx.objectStore('playerOrigins');
    for (const origin of freshmen.origins) {
      await originStore.add(origin);
    }
    await tx.objectStore('recruiting').put(toRecruitingRecord(next));
    assertCurrentLeagueState(league);
    await tx.objectStore('league').put({ key: LEAGUE_KEY, value: league });
    await tx.done;
    return cursor(league, next, commitments);
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const finalizeRecruiting = async (
  guard: RecruitingCommandGuard & { expectedRound: 6 },
): Promise<RecruitingCommandCursor> => {
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'players', 'recruiting', 'playerOrigins'],
    'readwrite',
  );
  try {
    const { league, state } = loadGuardedRecruitingRecords(
      await tx.objectStore('league').get(LEAGUE_KEY),
      await tx.objectStore('recruiting').get(RECRUITING_KEY),
      guard,
    );
    assertStatus(state, 'ready_for_signing_day');
    const existingPlayers = await tx.objectStore('players').getAll();
    assertCurrentRosterState(league, existingPlayers);
    const context = buildRecruitingContext(league.teams, existingPlayers);
    const result = resolveSigningDay(state, context);
    const next = asPersistedState(result.state, state);
    const freshmen = buildCommittedFreshmen({
      prospects: next.prospects,
      existingPlayers,
      nextPlayerId: league.idCounters.player,
      acquisitionYear: next.year,
    });
    league.idCounters.player = freshmen.nextPlayerId;
    league.info.stage = 'recruiting_summary';

    const playerStore = tx.objectStore('players');
    for (const player of freshmen.players) {
      await playerStore.add(player);
    }
    const originStore = tx.objectStore('playerOrigins');
    for (const origin of freshmen.origins) {
      await originStore.add(origin);
    }
    await tx.objectStore('recruiting').put(toRecruitingRecord(next));
    assertCurrentLeagueState(league);
    await tx.objectStore('league').put({ key: LEAGUE_KEY, value: league });
    await tx.done;
    return cursor(league, next, result.commitments);
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};
