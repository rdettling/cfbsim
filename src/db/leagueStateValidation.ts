import type { PlayerRecord } from '../types/db';
import type {
  ConferenceFinalStandingEntry,
  ConferenceFinalStandings,
  LeagueStage,
  Info,
  NextSeasonConfiguration,
  ScheduleGame,
  Team,
} from '../types/domain';
import {
  LeagueDataIntegrityError,
  type LeagueState,
} from '../types/league';

const LEAGUE_KEYS = [
  'info',
  'teams',
  'conferences',
  'pending_rivalries',
  'declinedRivalries',
  'rivalryHostSeeds',
  'scheduleBuilt',
  'simInitialized',
  'settings',
  'playoff',
  'resumeSnapshot',
  'idCounters',
] as const;
const INFO_KEYS = [
  'currentWeek',
  'lastRankingsWeek',
  'currentYear',
  'startYear',
  'stage',
  'team',
  'lastWeek',
] as const;
const TEAM_KEYS = [
  'id',
  'name',
  'abbreviation',
  'confGames',
  'confLimit',
  'nonConfGames',
  'nonConfLimit',
  'prestige',
  'ceiling',
  'floor',
  'mascot',
  'city',
  'state',
  'stadium',
  'ranking',
  'offense',
  'defense',
  'colorPrimary',
  'colorSecondary',
  'conference',
  'confName',
  'confWins',
  'confLosses',
  'nonConfWins',
  'nonConfLosses',
  'rating',
  'totalWins',
  'totalLosses',
  'gamesPlayed',
  'record',
  'movement',
  'poll_score',
  'wins_over_expectation',
  'wins_over_expectation_per_game',
  'last_rank',
  'last_game',
  'next_game',
] as const;
const CONFERENCE_KEYS = [
  'id',
  'confName',
  'confFullName',
  'confGames',
  'info',
  'championship',
  'finalStandings',
  'teams',
] as const;
const CONFERENCE_FINAL_STANDINGS_KEYS = ['year', 'entries'] as const;
const CONFERENCE_FINAL_STANDING_ENTRY_KEYS = [
  'teamId',
  'pollRank',
  'resolvedBy',
] as const;
const PENDING_RIVALRY_KEYS = [
  'id',
  'teamA',
  'teamB',
  'name',
  'homeTeam',
  'awayTeam',
  'neutralSite',
  'venue',
] as const;
const SETTINGS_KEYS = [
  'conferencePolicy',
  'postseasonPolicy',
  'playoffTeams',
  'playoffAutobids',
  'conferenceChampionsReceiveTopSeeds',
] as const;
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
const RESUME_SNAPSHOT_KEYS = ['year', 'frozenAfterWeek', 'playoff', 'teams'] as const;
const RESUME_PLAYOFF_KEYS = [
  'teams',
  'autobids',
  'conferenceChampionsReceiveTopSeeds',
] as const;
const RESUME_TEAM_KEYS = [
  'teamId',
  'name',
  'ranking',
  'conference',
  'record',
  'pollScore',
  'winsOverExpectationRank',
  'sosRank',
  'top25Record',
  'bestWin',
  'worstLoss',
  'seed',
  'isAutobid',
  'hasBye',
  'isChampion',
] as const;
const RESUME_RESULT_KEYS = ['opponentId', 'opponent', 'opponentRanking'] as const;
const SCHEDULE_GAME_KEYS = [
  'weekPlayed',
  'opponent',
  'label',
  'result',
  'score',
  'spread',
  'moneyline',
  'id',
  'location',
  'venue',
] as const;
const SCHEDULE_GAME_REQUIRED_KEYS = [
  'weekPlayed',
  'opponent',
  'result',
  'score',
  'spread',
  'moneyline',
  'id',
  'venue',
] as const;
const SCHEDULE_OPPONENT_KEYS = ['name', 'rating', 'ranking', 'record'] as const;
const PLAYER_KEYS = [
  'id',
  'teamId',
  'first',
  'last',
  'year',
  'pos',
  'rating',
  'rating_fr',
  'rating_so',
  'rating_jr',
  'rating_sr',
  'stars',
  'starter',
] as const;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every(key => keys.includes(key));

const hasRequiredKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  keys.every(key => Object.prototype.hasOwnProperty.call(value, key));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isIntegerAtLeast = (value: unknown, minimum: number) =>
  Number.isInteger(value) && Number(value) >= minimum;

const isNonemptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isNullableString = (value: unknown) =>
  value === null || isNonemptyString(value);

const isScheduleGame = (value: unknown): value is ScheduleGame => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, SCHEDULE_GAME_KEYS) ||
    !hasRequiredKeys(value, SCHEDULE_GAME_REQUIRED_KEYS)
  ) {
    return false;
  }
  const opponent = value.opponent;
  return (
    isIntegerAtLeast(value.weekPlayed, 0) &&
    (opponent === null || (
      isRecord(opponent) &&
      hasExactKeys(opponent, SCHEDULE_OPPONENT_KEYS) &&
      isNonemptyString(opponent.name) &&
      isFiniteNumber(opponent.rating) &&
      isIntegerAtLeast(opponent.ranking, 0) &&
      typeof opponent.record === 'string'
    )) &&
    (value.label === undefined || isNonemptyString(value.label)) &&
    typeof value.result === 'string' &&
    typeof value.score === 'string' &&
    typeof value.spread === 'string' &&
    typeof value.moneyline === 'string' &&
    isNonemptyString(value.id) &&
    (value.location === undefined ||
      value.location === 'Home' ||
      value.location === 'Away' ||
      value.location === 'Neutral') &&
    (value.venue === null || isNonemptyString(value.venue))
  );
};

const isCurrentInfo = (value: unknown): value is Info =>
  isRecord(value) &&
  hasExactKeys(value, INFO_KEYS) &&
  isIntegerAtLeast(value.currentWeek, 0) &&
  isIntegerAtLeast(value.lastRankingsWeek, 0) &&
  isIntegerAtLeast(value.currentYear, 1) &&
  isIntegerAtLeast(value.startYear, 1) &&
  LEAGUE_STAGES.has(value.stage as LeagueStage) &&
  isNonemptyString(value.team) &&
  isIntegerAtLeast(value.lastWeek, 1);

const isCurrentTeam = (value: unknown): value is Team =>
  isRecord(value) &&
  hasExactKeys(value, TEAM_KEYS) &&
  isIntegerAtLeast(value.id, 1) &&
  isNonemptyString(value.name) &&
  isNonemptyString(value.abbreviation) &&
  isIntegerAtLeast(value.confGames, 0) &&
  isIntegerAtLeast(value.confLimit, 0) &&
  isIntegerAtLeast(value.nonConfGames, 0) &&
  isIntegerAtLeast(value.nonConfLimit, 0) &&
  Number.isInteger(value.prestige) &&
  Number(value.prestige) >= 1 &&
  Number(value.prestige) <= 7 &&
  Number.isInteger(value.ceiling) &&
  Number(value.ceiling) >= 1 &&
  Number(value.ceiling) <= 7 &&
  Number.isInteger(value.floor) &&
  Number(value.floor) >= 1 &&
  Number(value.floor) <= 7 &&
  Number(value.floor) <= Number(value.prestige) &&
  Number(value.prestige) <= Number(value.ceiling) &&
  isNonemptyString(value.mascot) &&
  isNonemptyString(value.city) &&
  isNonemptyString(value.state) &&
  isNonemptyString(value.stadium) &&
  isIntegerAtLeast(value.ranking, 1) &&
  isFiniteNumber(value.offense) &&
  isFiniteNumber(value.defense) &&
  isNonemptyString(value.colorPrimary) &&
  isNonemptyString(value.colorSecondary) &&
  isNonemptyString(value.conference) &&
  isNonemptyString(value.confName) &&
  isIntegerAtLeast(value.confWins, 0) &&
  isIntegerAtLeast(value.confLosses, 0) &&
  isIntegerAtLeast(value.nonConfWins, 0) &&
  isIntegerAtLeast(value.nonConfLosses, 0) &&
  isFiniteNumber(value.rating) &&
  isIntegerAtLeast(value.totalWins, 0) &&
  isIntegerAtLeast(value.totalLosses, 0) &&
  isIntegerAtLeast(value.gamesPlayed, 0) &&
  typeof value.record === 'string' &&
  Number.isInteger(value.movement) &&
  isFiniteNumber(value.poll_score) &&
  isFiniteNumber(value.wins_over_expectation) &&
  isFiniteNumber(value.wins_over_expectation_per_game) &&
  (value.last_rank === null || isIntegerAtLeast(value.last_rank, 1)) &&
  (value.last_game === null || isScheduleGame(value.last_game)) &&
  (value.next_game === null || isScheduleGame(value.next_game));

const isConferenceTiebreaker = (value: unknown) =>
  value === 'head_to_head' ||
  value === 'common_opponents' ||
  value === 'overall_record' ||
  value === 'poll_rank';

const isConferenceFinalStandingEntry = (
  value: unknown,
): value is ConferenceFinalStandingEntry =>
  isRecord(value) &&
  hasExactKeys(value, CONFERENCE_FINAL_STANDING_ENTRY_KEYS) &&
  isIntegerAtLeast(value.teamId, 1) &&
  isIntegerAtLeast(value.pollRank, 1) &&
  (value.resolvedBy === null || isConferenceTiebreaker(value.resolvedBy));

const isConferenceFinalStandings = (
  value: unknown,
): value is ConferenceFinalStandings =>
  isRecord(value) &&
  hasExactKeys(value, CONFERENCE_FINAL_STANDINGS_KEYS) &&
  isIntegerAtLeast(value.year, 1) &&
  Array.isArray(value.entries) &&
  value.entries.length >= 2 &&
  value.entries.every(isConferenceFinalStandingEntry) &&
  new Set(value.entries.map(entry => entry.teamId)).size === value.entries.length &&
  new Set(value.entries.map(entry => entry.pollRank)).size === value.entries.length;

const isCurrentConference = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, CONFERENCE_KEYS) &&
  isIntegerAtLeast(value.id, 1) &&
  isNonemptyString(value.confName) &&
  isNonemptyString(value.confFullName) &&
  isIntegerAtLeast(value.confGames, 0) &&
  typeof value.info === 'string' &&
  (value.championship === null || isIntegerAtLeast(value.championship, 1)) &&
  (value.finalStandings === null || isConferenceFinalStandings(value.finalStandings)) &&
  Array.isArray(value.teams) &&
  value.teams.every(isCurrentTeam);

const hasCoherentConferenceFinalStandings = (
  conferences: unknown[],
  teams: unknown[],
  currentYear: number,
) => conferences.every(value => {
  if (!isRecord(value) || !Array.isArray(value.teams)) return false;
  if (value.confName === 'Independent') {
    return value.championship === null && value.finalStandings === null;
  }
  if ((value.championship === null) !== (value.finalStandings === null)) {
    return false;
  }
  if (value.finalStandings === null) return true;
  if (!isConferenceFinalStandings(value.finalStandings)) return false;
  if (value.finalStandings.year !== currentYear) return false;
  const memberIds = new Set(teams
    .filter(team => isRecord(team) && team.conference === value.confName)
    .map(team => isRecord(team) ? team.id : undefined));
  return (
    value.finalStandings.entries.length === memberIds.size &&
    value.finalStandings.entries.every(entry => memberIds.has(entry.teamId))
  );
});

const isPendingRivalry = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, PENDING_RIVALRY_KEYS) &&
  isIntegerAtLeast(value.id, 1) &&
  isNonemptyString(value.teamA) &&
  isNonemptyString(value.teamB) &&
  value.teamA !== value.teamB &&
  isNullableString(value.name) &&
  isNullableString(value.homeTeam) &&
  isNullableString(value.awayTeam) &&
  typeof value.neutralSite === 'boolean' &&
  isNullableString(value.venue);

const isCurrentSettings = (
  value: unknown,
): value is NextSeasonConfiguration =>
  isRecord(value) &&
  hasExactKeys(value, SETTINGS_KEYS) &&
  (value.conferencePolicy === 'historical' || value.conferencePolicy === 'current') &&
  (value.postseasonPolicy === 'historical' || value.postseasonPolicy === 'custom') &&
  (value.playoffTeams === 2 || value.playoffTeams === 4 || value.playoffTeams === 12) &&
  isIntegerAtLeast(value.playoffAutobids, 0) &&
  typeof value.conferenceChampionsReceiveTopSeeds === 'boolean';

const isCurrentPlayoffState = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, PLAYOFF_KEYS) ||
    !Object.prototype.hasOwnProperty.call(value, 'seeds') ||
    !Array.isArray(value.seeds) ||
    !value.seeds.every(seed => isIntegerAtLeast(seed, 1))
  ) {
    return false;
  }
  return PLAYOFF_KEYS.slice(1).every(key =>
    !Object.prototype.hasOwnProperty.call(value, key) ||
    isIntegerAtLeast(value[key], 1));
};

const isResumeResult = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, RESUME_RESULT_KEYS) &&
  isIntegerAtLeast(value.opponentId, 1) &&
  isNonemptyString(value.opponent) &&
  isIntegerAtLeast(value.opponentRanking, 1);

const isResumeTeam = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, RESUME_TEAM_KEYS) &&
  isIntegerAtLeast(value.teamId, 1) &&
  isNonemptyString(value.name) &&
  isIntegerAtLeast(value.ranking, 1) &&
  isNonemptyString(value.conference) &&
  typeof value.record === 'string' &&
  isFiniteNumber(value.pollScore) &&
  isIntegerAtLeast(value.winsOverExpectationRank, 1) &&
  (value.sosRank === null || isIntegerAtLeast(value.sosRank, 1)) &&
  typeof value.top25Record === 'string' &&
  (value.bestWin === null || isResumeResult(value.bestWin)) &&
  (value.worstLoss === null || isResumeResult(value.worstLoss)) &&
  (value.seed === null || isIntegerAtLeast(value.seed, 1)) &&
  typeof value.isAutobid === 'boolean' &&
  typeof value.hasBye === 'boolean' &&
  typeof value.isChampion === 'boolean';

const isResumeSnapshot = (value: unknown) => {
  if (!isRecord(value) || !hasExactKeys(value, RESUME_SNAPSHOT_KEYS)) {
    return false;
  }
  const playoff = value.playoff;
  return (
    isIntegerAtLeast(value.year, 1) &&
    isIntegerAtLeast(value.frozenAfterWeek, 0) &&
    isRecord(playoff) &&
    hasExactKeys(playoff, RESUME_PLAYOFF_KEYS) &&
    (playoff.teams === 2 || playoff.teams === 4 || playoff.teams === 12) &&
    isIntegerAtLeast(playoff.autobids, 0) &&
    typeof playoff.conferenceChampionsReceiveTopSeeds === 'boolean' &&
    Array.isArray(value.teams) &&
    value.teams.length > 0 &&
    value.teams.every(isResumeTeam)
  );
};

const isCurrentPlayerRecord = (value: unknown): value is PlayerRecord =>
  isRecord(value) &&
  hasExactKeys(value, PLAYER_KEYS) &&
  isIntegerAtLeast(value.id, 1) &&
  isIntegerAtLeast(value.teamId, 1) &&
  isNonemptyString(value.first) &&
  isNonemptyString(value.last) &&
  (value.year === 'fr' || value.year === 'so' || value.year === 'jr' || value.year === 'sr') &&
  isNonemptyString(value.pos) &&
  isFiniteNumber(value.rating) &&
  isFiniteNumber(value.rating_fr) &&
  isFiniteNumber(value.rating_so) &&
  isFiniteNumber(value.rating_jr) &&
  isFiniteNumber(value.rating_sr) &&
  isFiniteNumber(value.stars) &&
  typeof value.starter === 'boolean';

export function assertCurrentLeagueState(
  value: unknown,
): asserts value is LeagueState {
  const info = isRecord(value) ? value.info : undefined;
  const counters = isRecord(value) ? value.idCounters : undefined;
  const valid =
    isRecord(value) &&
    hasExactKeys(value, LEAGUE_KEYS) &&
    isCurrentInfo(info) &&
    Array.isArray(value.teams) &&
    value.teams.length > 0 &&
    value.teams.every(isCurrentTeam) &&
    value.teams.some(team => team.name === info.team) &&
    Array.isArray(value.conferences) &&
    value.conferences.length > 0 &&
    value.conferences.every(isCurrentConference) &&
    hasCoherentConferenceFinalStandings(value.conferences, value.teams, info.currentYear) &&
    Array.isArray(value.pending_rivalries) &&
    value.pending_rivalries.every(isPendingRivalry) &&
    Array.isArray(value.declinedRivalries) &&
    value.declinedRivalries.every(isNonemptyString) &&
    isRecord(value.rivalryHostSeeds) &&
    Object.values(value.rivalryHostSeeds).every(seed => typeof seed === 'string') &&
    typeof value.scheduleBuilt === 'boolean' &&
    typeof value.simInitialized === 'boolean' &&
    isCurrentSettings(value.settings) &&
    isCurrentPlayoffState(value.playoff) &&
    (value.resumeSnapshot === null || isResumeSnapshot(value.resumeSnapshot)) &&
    isRecord(counters) &&
    hasExactKeys(counters, ID_COUNTER_KEYS) &&
    ID_COUNTER_KEYS.every(key => isIntegerAtLeast(counters[key], 1));

  if (!valid) {
    throw new LeagueDataIntegrityError(
      'INVALID_LEAGUE_STATE',
      'The saved league does not match the current data model. Start a new league.',
    );
  }
}

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

export function assertCurrentPlayerRecords(
  league: LeagueState,
  players: unknown[],
): asserts players is PlayerRecord[] {
  const teamIds = new Set(league.teams.map(team => team.id));
  if (players.some(player =>
    !isCurrentPlayerRecord(player) || !teamIds.has(player.teamId)
  )) {
    throw new LeagueDataIntegrityError(
      'INVALID_ROSTER_STATE',
      'The saved player records do not match the current data model.',
    );
  }
}
