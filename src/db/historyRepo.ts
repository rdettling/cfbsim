import type {
  HistoricalPlayerRecord,
  PlayerRecord,
  PlayerSeasonStats,
} from '../types/db';
import { PLAYER_SEASON_STAT_KEYS } from '../domain/league/gameDetails';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const IDENTITY_KEYS = [
  'id',
  'first',
  'last',
  'pos',
  'stars',
] as const;

const isHistoricalPlayer = (value: unknown): value is HistoricalPlayerRecord =>
  isRecord(value)
  && hasExactKeys(value, IDENTITY_KEYS)
  && Number.isInteger(value.id)
  && Number(value.id) > 0
  && typeof value.first === 'string'
  && value.first.length > 0
  && typeof value.last === 'string'
  && value.last.length > 0
  && typeof value.pos === 'string'
  && value.pos.length > 0
  && isFiniteNumber(value.stars);

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

const isPlayerSeason = (value: unknown): value is PlayerSeasonStats =>
  isRecord(value)
  && hasExactKeys(value, PLAYER_SEASON_KEYS)
  && Number.isInteger(value.year)
  && Number(value.year) > 0
  && Number.isInteger(value.playerId)
  && Number(value.playerId) > 0
  && Number.isInteger(value.teamId)
  && Number(value.teamId) > 0
  && typeof value.position === 'string'
  && value.position.length > 0
  && ['fr', 'so', 'jr', 'sr'].includes(String(value.classYear))
  && isFiniteNumber(value.rating)
  && typeof value.starter === 'boolean'
  && Number.isInteger(value.games)
  && Number(value.games) > 0
  && PLAYER_SEASON_STAT_KEYS.every(key => isFiniteNumber(value[key]));

export const assertHistoricalIntegrity = ({
  currentPlayers,
  historicalPlayers,
  playerSeasons,
}: {
  currentPlayers: PlayerRecord[];
  historicalPlayers: HistoricalPlayerRecord[];
  playerSeasons: PlayerSeasonStats[];
}) => {
  if (
    historicalPlayers.some(player => !isHistoricalPlayer(player))
    || playerSeasons.some(season => !isPlayerSeason(season))
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
};
