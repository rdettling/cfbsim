import type { LeagueStage, NextSeasonConfiguration } from '../types/domain';
import {
  LeagueDataIntegrityError,
  type LeagueState,
} from '../types/league';
import type { PlayerRecord } from '../types/db';
import { getDb } from './db';

const LEAGUE_KEY = 'current';

const LEAGUE_STAGES = new Set<LeagueStage>([
  'preseason',
  'season',
  'summary',
  'realignment',
  'progression',
  'recruiting',
  'recruiting_summary',
  'roster_cuts',
]);
const ID_COUNTER_KEYS = ['game', 'player'] as const;
const PLAYOFF_KEYS = [
  'seeds',
  'left_r1_1',
  'left_r1_2',
  'right_r1_1',
  'right_r1_2',
  'left_quarter_1',
  'left_quarter_2',
  'right_quarter_1',
  'right_quarter_2',
  'left_semi',
  'right_semi',
  'natty',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const isCurrentSettings = (
  value: unknown,
): value is NextSeasonConfiguration => {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== 5 ||
    !keys.every(key =>
      [
        'conferencePolicy',
        'postseasonPolicy',
        'playoffTeams',
        'playoffAutobids',
        'conferenceChampionsReceiveTopSeeds',
      ].includes(key),
    )
  ) {
    return false;
  }
  return (
    (value.conferencePolicy === 'historical' ||
      value.conferencePolicy === 'current') &&
    (value.postseasonPolicy === 'historical' ||
      value.postseasonPolicy === 'custom') &&
    (value.playoffTeams === 2 ||
      value.playoffTeams === 4 ||
      value.playoffTeams === 12) &&
    Number.isInteger(value.playoffAutobids) &&
    typeof value.conferenceChampionsReceiveTopSeeds === 'boolean'
  );
};

const isCurrentTeamMetadata = (value: unknown) =>
  isRecord(value) &&
  Number.isInteger(value.id) &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  typeof value.abbreviation === 'string' &&
  typeof value.conference === 'string';

const isCurrentConferenceMetadata = (value: unknown) =>
  isRecord(value) &&
  Number.isInteger(value.id) &&
  typeof value.confName === 'string' &&
  typeof value.confFullName === 'string' &&
  isFiniteNumber(value.confGames) &&
  Array.isArray(value.teams) &&
  value.teams.every(isCurrentTeamMetadata);

const isCurrentPlayoffState = (value: unknown) => {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.includes('seeds') &&
    keys.every(key => PLAYOFF_KEYS.includes(key as (typeof PLAYOFF_KEYS)[number])) &&
    Array.isArray(value.seeds) &&
    value.seeds.every(Number.isInteger) &&
    PLAYOFF_KEYS.slice(1).every(
      key => value[key] === undefined || Number.isInteger(value[key]),
    )
  );
};

const isResumeResult = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, ['opponentId', 'opponent', 'opponentRanking']) &&
  Number.isInteger(value.opponentId) &&
  typeof value.opponent === 'string' &&
  value.opponent.length > 0 &&
  Number.isInteger(value.opponentRanking) &&
  Number(value.opponentRanking) > 0;

const RESUME_TEAM_KEYS = [
  'teamId',
  'name',
  'ranking',
  'conference',
  'record',
  'pollScore',
  'sorRank',
  'sosRank',
  'top25Record',
  'bestWin',
  'worstLoss',
  'seed',
  'isAutobid',
  'hasBye',
  'isChampion',
] as const;

const isResumeTeam = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, RESUME_TEAM_KEYS) &&
  Number.isInteger(value.teamId) &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  Number.isInteger(value.ranking) &&
  Number(value.ranking) > 0 &&
  typeof value.conference === 'string' &&
  typeof value.record === 'string' &&
  isFiniteNumber(value.pollScore) &&
  Number.isInteger(value.sorRank) &&
  Number(value.sorRank) > 0 &&
  (value.sosRank === null || (Number.isInteger(value.sosRank) && Number(value.sosRank) > 0)) &&
  typeof value.top25Record === 'string' &&
  (value.bestWin === null || isResumeResult(value.bestWin)) &&
  (value.worstLoss === null || isResumeResult(value.worstLoss)) &&
  (value.seed === null || (Number.isInteger(value.seed) && Number(value.seed) > 0)) &&
  typeof value.isAutobid === 'boolean' &&
  typeof value.hasBye === 'boolean' &&
  typeof value.isChampion === 'boolean';

const isResumeSnapshot = (value: unknown) => {
  if (!isRecord(value) || !hasExactKeys(value, ['year', 'frozenAfterWeek', 'playoff', 'teams'])) {
    return false;
  }
  const playoff = value.playoff;
  return (
    Number.isInteger(value.year) &&
    Number.isInteger(value.frozenAfterWeek) &&
    isRecord(playoff) &&
    hasExactKeys(playoff, ['teams', 'autobids', 'conferenceChampionsReceiveTopSeeds']) &&
    (playoff.teams === 2 || playoff.teams === 4 || playoff.teams === 12) &&
    Number.isInteger(playoff.autobids) &&
    typeof playoff.conferenceChampionsReceiveTopSeeds === 'boolean' &&
    Array.isArray(value.teams) &&
    value.teams.length > 0 &&
    value.teams.every(isResumeTeam)
  );
};

export function assertCurrentLeagueState(
  value: unknown,
): asserts value is LeagueState {
  if (!isRecord(value) || !isRecord(value.info)) {
    throw new LeagueDataIntegrityError(
      'INVALID_LEAGUE_STATE',
      'The saved league does not match the current data model. Start a new league.',
    );
  }
  const { info } = value;
  const counters = value.idCounters;
  const validCounters =
    isRecord(counters) &&
    Object.keys(counters).length === ID_COUNTER_KEYS.length &&
    ID_COUNTER_KEYS.every(
      key => Number.isInteger(counters[key]) && Number(counters[key]) >= 1,
    );
  const valid =
    LEAGUE_STAGES.has(info.stage as LeagueStage) &&
    isFiniteNumber(info.currentWeek) &&
    isFiniteNumber(info.currentYear) &&
    isFiniteNumber(info.startYear) &&
    typeof info.team === 'string' &&
    isFiniteNumber(info.lastWeek) &&
    Array.isArray(value.teams) &&
    value.teams.length > 0 &&
    value.teams.every(isCurrentTeamMetadata) &&
    value.teams.some(team => team.name === info.team) &&
    Array.isArray(value.conferences) &&
    value.conferences.every(isCurrentConferenceMetadata) &&
    Array.isArray(value.pending_rivalries) &&
    Array.isArray(value.declinedRivalries) &&
    value.declinedRivalries.every(
      key => typeof key === 'string' && key.length > 0,
    ) &&
    isRecord(value.rivalryHostSeeds) &&
    Object.values(value.rivalryHostSeeds).every(
      seed => typeof seed === 'string',
    ) &&
    typeof value.scheduleBuilt === 'boolean' &&
    typeof value.simInitialized === 'boolean' &&
    isCurrentSettings(value.settings) &&
    isCurrentPlayoffState(value.playoff) &&
    Object.prototype.hasOwnProperty.call(value, 'resumeSnapshot') &&
    (value.resumeSnapshot === null || isResumeSnapshot(value.resumeSnapshot)) &&
    validCounters;
  if (!valid) {
    throw new LeagueDataIntegrityError(
      'INVALID_LEAGUE_STATE',
      'The saved league does not match the current data model. Start a new league.',
    );
  }
}

const isCurrentPlayerRecord = (value: unknown): value is PlayerRecord => {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.id) &&
    Number.isInteger(value.teamId) &&
    typeof value.first === 'string' &&
    value.first.length > 0 &&
    typeof value.last === 'string' &&
    value.last.length > 0 &&
    (value.year === 'fr' ||
      value.year === 'so' ||
      value.year === 'jr' ||
      value.year === 'sr') &&
    typeof value.pos === 'string' &&
    value.pos.length > 0 &&
    isFiniteNumber(value.rating) &&
    isFiniteNumber(value.rating_fr) &&
    isFiniteNumber(value.rating_so) &&
    isFiniteNumber(value.rating_jr) &&
    isFiniteNumber(value.rating_sr) &&
    isFiniteNumber(value.stars) &&
    isFiniteNumber(value.development_trait) &&
    typeof value.starter === 'boolean' &&
    Object.keys(value).length === 14
  );
};

export function assertCurrentRosterState(
  league: LeagueState,
  players: unknown[],
): asserts players is PlayerRecord[] {
  const teamIds = new Set(league.teams.map(team => team.id));
  const coveredTeamIds = new Set<number>();
  const valid =
    players.length > 0 &&
    players.every(player => {
      if (!isCurrentPlayerRecord(player) || !teamIds.has(player.teamId)) {
        return false;
      }
      coveredTeamIds.add(player.teamId);
      return true;
    }) &&
    league.teams.every(team => coveredTeamIds.has(team.id));
  if (!valid) {
    throw new LeagueDataIntegrityError(
      'INVALID_ROSTER_STATE',
      'The saved roster does not match the current data model. Start a new league.',
    );
  }
}

export const loadLeague = async (): Promise<LeagueState | null> => {
  const db = await getDb();
  const record = await db.get('league', LEAGUE_KEY);
  if (!record) return null;
  assertCurrentLeagueState(record.value);
  return record.value;
};

export const saveLeague = async (league: LeagueState): Promise<void> => {
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
