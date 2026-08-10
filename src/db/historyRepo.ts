import type {
  GameDetailRecord,
  HistoricalPlayerRecord,
  PlayerRecord,
  PlayerSeasonStats,
} from '../types/db';
import { PLAYER_SEASON_STAT_KEYS } from '../domain/league/gameDetails';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};
const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const IDENTITY_KEYS = [
  'id',
  'first',
  'last',
  'pos',
  'stars',
  'development_trait',
] as const;
export const isHistoricalPlayer = (
  value: unknown,
): value is HistoricalPlayerRecord =>
  isRecord(value) &&
  exact(value, IDENTITY_KEYS) &&
  Number.isInteger(value.id) &&
  typeof value.first === 'string' &&
  value.first.length > 0 &&
  typeof value.last === 'string' &&
  value.last.length > 0 &&
  typeof value.pos === 'string' &&
  value.pos.length > 0 &&
  finite(value.stars) &&
  finite(value.development_trait);

const PLAYER_SEASON_KEYS = [
  'year',
  'playerId',
  'teamId',
  'position',
  'classYear',
  'rating',
  'starter',
  'games',
  ...PLAYER_SEASON_STAT_KEYS,
] as const;
export const isPlayerSeason = (value: unknown): value is PlayerSeasonStats =>
  isRecord(value) &&
  exact(value, PLAYER_SEASON_KEYS) &&
  Number.isInteger(value.year) &&
  Number.isInteger(value.playerId) &&
  Number.isInteger(value.teamId) &&
  typeof value.position === 'string' &&
  ['fr', 'so', 'jr', 'sr'].includes(String(value.classYear)) &&
  finite(value.rating) &&
  typeof value.starter === 'boolean' &&
  Number.isInteger(value.games) &&
  Number(value.games) > 0 &&
  PLAYER_SEASON_STAT_KEYS.every(key => finite(value[key]));

const DETAIL_PLAY_KEYS = [
  'startingFP',
  'down',
  'yardsLeft',
  'playType',
  'yardsGained',
  'result',
  'text',
  'header',
  'scoreA',
  'scoreB',
  'quarter',
  'clockSecondsLeft',
  'playSeconds',
] as const;
const DETAIL_DRIVE_KEYS = [
  'driveNum',
  'offenseId',
  'defenseId',
  'startingFP',
  'result',
  'points',
  'points_needed',
  'scoreAAfter',
  'scoreBAfter',
  'plays',
] as const;
const LOG_KEYS = ['playerId', ...PLAYER_SEASON_STAT_KEYS] as const;
export const isGameDetail = (value: unknown): value is GameDetailRecord => {
  if (
    !isRecord(value) ||
    !exact(value, ['gameId', 'year', 'drives', 'playerStats']) ||
    !Number.isInteger(value.gameId) ||
    !Number.isInteger(value.year) ||
    !Array.isArray(value.drives) ||
    !Array.isArray(value.playerStats)
  ) return false;
  return value.drives.every(drive =>
    isRecord(drive) &&
    exact(drive, DETAIL_DRIVE_KEYS) &&
    ['driveNum', 'offenseId', 'defenseId', 'startingFP', 'points', 'points_needed',
      'scoreAAfter', 'scoreBAfter'].every(key => finite(drive[key])) &&
    typeof drive.result === 'string' &&
    Array.isArray(drive.plays) &&
    drive.plays.every(play =>
      isRecord(play) &&
      exact(play, DETAIL_PLAY_KEYS) &&
      DETAIL_PLAY_KEYS.every(key =>
        ['playType', 'result', 'text', 'header'].includes(key)
          ? typeof play[key] === 'string'
          : finite(play[key]),
      ),
    ),
  ) && value.playerStats.every(log =>
    isRecord(log) &&
    exact(log, LOG_KEYS) &&
    Number.isInteger(log.playerId) &&
    PLAYER_SEASON_STAT_KEYS.every(key => finite(log[key])),
  );
};

export const assertHistoricalIntegrity = ({
  currentPlayers,
  historicalPlayers,
  playerSeasons,
  details,
  gameIds,
}: {
  currentPlayers: PlayerRecord[];
  historicalPlayers: HistoricalPlayerRecord[];
  playerSeasons: PlayerSeasonStats[];
  details: GameDetailRecord[];
  gameIds: Set<number>;
}) => {
  if (
    historicalPlayers.some(player => !isHistoricalPlayer(player)) ||
    playerSeasons.some(season => !isPlayerSeason(season)) ||
    details.some(detail => !isGameDetail(detail) || !gameIds.has(detail.gameId))
  ) throw new Error('Saved historical data does not match the current data model.');
  const currentIds = new Set(currentPlayers.map(player => player.id));
  const historicalIds = new Set<number>();
  for (const player of historicalPlayers) {
    if (currentIds.has(player.id) || historicalIds.has(player.id)) {
      throw new Error('Player identity appears in multiple stores.');
    }
    historicalIds.add(player.id);
  }
  const identityIds = new Set([...currentIds, ...historicalIds]);
  const seasonKeys = new Set<string>();
  for (const season of playerSeasons) {
    const key = `${season.year}:${season.playerId}`;
    if (!identityIds.has(season.playerId) || seasonKeys.has(key)) {
      throw new Error('Player season has a dangling or duplicate identity.');
    }
    seasonKeys.add(key);
  }
  for (const detail of details) {
    if (detail.playerStats.some(log => !identityIds.has(log.playerId))) {
      throw new Error('Game detail has a dangling player identity.');
    }
  }
};
