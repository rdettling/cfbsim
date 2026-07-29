import {
  RecruitingDataIntegrityError,
  type RecruitingInterestEntry,
  type RecruitingPreferenceWeights,
  type RecruitingProspect,
  type RecruitingRound,
  type RecruitingState,
  type TeamRecruitingState,
} from '../types/recruiting';
import { getDb } from './db';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from './leagueRepo';

export const RECRUITING_KEY = 'current';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) => {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    actual.every(key => keys.includes(key))
  );
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isInteger = (value: unknown): value is number =>
  Number.isInteger(value);

const isRound = (value: unknown): value is RecruitingRound =>
  isInteger(value) && value >= 1 && value <= 6;

const isIntegerArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isInteger);

const hasUniqueValues = (values: number[]) =>
  new Set(values).size === values.length;

const isPreferenceWeights = (
  value: unknown,
): value is RecruitingPreferenceWeights =>
  isRecord(value) &&
  hasExactKeys(value, [
    'prestige',
    'proximity',
    'playingTime',
    'recentSuccess',
  ]) &&
  Object.values(value).every(isFiniteNumber);

const isInterestEntry = (
  value: unknown,
): value is RecruitingInterestEntry =>
  isRecord(value) &&
  hasExactKeys(value, [
    'teamId',
    'fit',
    'initial',
    'earned',
    'lifetimePoints',
  ]) &&
  isInteger(value.teamId) &&
  isFiniteNumber(value.fit) &&
  isFiniteNumber(value.initial) &&
  isFiniteNumber(value.earned) &&
  isFiniteNumber(value.lifetimePoints);

const isProspect = (value: unknown): value is RecruitingProspect => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'id',
      'nationalRank',
      'first',
      'last',
      'state',
      'position',
      'stars',
      'ratingFr',
      'ratingSo',
      'ratingJr',
      'ratingSr',
      'developmentTrait',
      'publicRatingMin',
      'publicRatingMax',
      'preferenceWeights',
      'interest',
      'committedTeamId',
      'committedRound',
    ])
  ) {
    return false;
  }
  const committedRound = value.committedRound;
  return (
    isInteger(value.id) &&
    isInteger(value.nationalRank) &&
    typeof value.first === 'string' &&
    value.first.length > 0 &&
    typeof value.last === 'string' &&
    value.last.length > 0 &&
    typeof value.state === 'string' &&
    value.state.length > 0 &&
    typeof value.position === 'string' &&
    value.position.length > 0 &&
    isInteger(value.stars) &&
    isFiniteNumber(value.ratingFr) &&
    isFiniteNumber(value.ratingSo) &&
    isFiniteNumber(value.ratingJr) &&
    isFiniteNumber(value.ratingSr) &&
    isFiniteNumber(value.developmentTrait) &&
    isFiniteNumber(value.publicRatingMin) &&
    isFiniteNumber(value.publicRatingMax) &&
    isPreferenceWeights(value.preferenceWeights) &&
    Array.isArray(value.interest) &&
    value.interest.every(isInterestEntry) &&
    (value.committedTeamId === null || isInteger(value.committedTeamId)) &&
    (committedRound === null ||
      committedRound === 'signing_day' ||
      isRound(committedRound))
  );
};

const isAllocations = (
  value: unknown,
): value is Record<number, number> =>
  isRecord(value) &&
  Object.entries(value).every(
    ([prospectId, points]) =>
      String(Number(prospectId)) === prospectId &&
      isInteger(Number(prospectId)) &&
      isInteger(points) &&
      points >= 0,
  );

const isTeamState = (value: unknown): value is TeamRecruitingState =>
  isRecord(value) &&
  hasExactKeys(value, [
    'teamId',
    'board',
    'allocations',
    'commitmentIds',
    'baseSigningCapacity',
    'oversignCapacity',
    'pointBudget',
  ]) &&
  isInteger(value.teamId) &&
  isIntegerArray(value.board) &&
  hasUniqueValues(value.board) &&
  isAllocations(value.allocations) &&
  isIntegerArray(value.commitmentIds) &&
  hasUniqueValues(value.commitmentIds) &&
  isInteger(value.baseSigningCapacity) &&
  value.baseSigningCapacity >= 0 &&
  isInteger(value.oversignCapacity) &&
  value.oversignCapacity >= 0 &&
  isInteger(value.pointBudget) &&
  value.pointBudget > 0;

export function assertCurrentRecruitingState(
  value: unknown,
): asserts value is RecruitingState {
  const valid =
    isRecord(value) &&
    hasExactKeys(value, [
      'year',
      'round',
      'status',
      'seed',
      'prospects',
      'teams',
      'version',
      'pendingUserCutIds',
    ]) &&
    isInteger(value.year) &&
    isRound(value.round) &&
    (value.status === 'active' ||
      value.status === 'ready_for_signing_day' ||
      value.status === 'finalized') &&
    isInteger(value.seed) &&
    value.seed >= 0 &&
    value.seed <= 0xffff_ffff &&
    Array.isArray(value.prospects) &&
    value.prospects.every(isProspect) &&
    Array.isArray(value.teams) &&
    value.teams.every(isTeamState) &&
    isInteger(value.version) &&
    value.version >= 1 &&
    isIntegerArray(value.pendingUserCutIds) &&
    hasUniqueValues(value.pendingUserCutIds);

  if (!valid) {
    throw new RecruitingDataIntegrityError();
  }

  const state = value as unknown as RecruitingState;
  const prospectIds = state.prospects.map(prospect => prospect.id);
  const teamIds = state.teams.map(team => team.teamId);
  const uniqueIds =
    hasUniqueValues(prospectIds) &&
    hasUniqueValues(teamIds) &&
    state.prospects.every(prospect =>
      hasUniqueValues(prospect.interest.map(entry => entry.teamId)),
    );
  if (!uniqueIds) {
    throw new RecruitingDataIntegrityError();
  }
}

export const toRecruitingRecord = (state: RecruitingState) => {
  assertCurrentRecruitingState(state);
  return {
    key: RECRUITING_KEY,
    value: state,
  };
};

export const loadRecruitingState = async (): Promise<RecruitingState | null> => {
  const db = await getDb();
  const record = await db.get('recruiting', RECRUITING_KEY);
  if (!record) return null;
  assertCurrentRecruitingState(record.value);
  return record.value;
};

export const loadRecruitingLifecycleSnapshot = async () => {
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'recruiting', 'players'],
    'readonly',
  );
  const [leagueRecord, recruitingRecord, players] = await Promise.all([
    tx.objectStore('league').get('current'),
    tx.objectStore('recruiting').get(RECRUITING_KEY),
    tx.objectStore('players').getAll(),
  ]);
  await tx.done;
  if (!leagueRecord) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  assertCurrentLeagueState(leagueRecord.value);
  assertCurrentRosterState(leagueRecord.value, players);
  if (recruitingRecord) {
    assertCurrentRecruitingState(recruitingRecord.value);
  }
  return {
    league: leagueRecord.value,
    recruiting: recruitingRecord?.value ?? null,
    players,
  };
};

export const abortTransaction = async (
  tx: { abort(): void; done: Promise<unknown> },
) => {
  try {
    tx.abort();
  } catch {
    // The transaction may already be closed or aborted.
  }
  try {
    await tx.done;
  } catch {
    // Explicit abort rejects transaction completion.
  }
};
