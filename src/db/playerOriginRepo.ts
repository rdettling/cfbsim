import type { LeagueState } from '../types/league';
import type {
  HistoricalPlayerRecord,
  PlayerOrigin,
  PlayerRecord,
} from '../types/db';
import { getDb } from './db';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};
const positiveInteger = (value: unknown) =>
  Number.isInteger(value) && Number(value) > 0;
const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);
const rating = (value: unknown) =>
  finite(value) && Number(value) >= 0 && Number(value) <= 100;

const BASE_KEYS = [
  'playerId',
  'kind',
  'acquisitionYear',
  'originalTeamId',
] as const;
const RECRUIT_KEYS = [
  ...BASE_KEYS,
  'homeState',
  'nationalRank',
  'positionRank',
  'commitmentRound',
  'publicRatingMin',
  'publicRatingMax',
] as const;

export const isPlayerOrigin = (value: unknown): value is PlayerOrigin => {
  if (
    !isRecord(value) ||
    !positiveInteger(value.playerId) ||
    !Number.isInteger(value.acquisitionYear) ||
    !positiveInteger(value.originalTeamId)
  ) return false;
  if (value.kind === 'walk_on') return exact(value, BASE_KEYS);
  if (value.kind === 'initial_roster') {
    return (
      exact(value, [...BASE_KEYS, 'classAtStart']) &&
      ['fr', 'so', 'jr', 'sr'].includes(String(value.classAtStart))
    );
  }
  return (
    value.kind === 'recruit' &&
    exact(value, RECRUIT_KEYS) &&
    typeof value.homeState === 'string' &&
    value.homeState.length > 0 &&
    positiveInteger(value.nationalRank) &&
    positiveInteger(value.positionRank) &&
    (value.commitmentRound === 'signing_day' ||
      [1, 2, 3, 4, 5, 6].includes(Number(value.commitmentRound))) &&
    Number(value.positionRank) <= Number(value.nationalRank) &&
    rating(value.publicRatingMin) &&
    rating(value.publicRatingMax) &&
    Number(value.publicRatingMin) <= Number(value.publicRatingMax)
  );
};

export const assertPlayerOriginIntegrity = ({
  league,
  currentPlayers,
  historicalPlayers,
  origins,
}: {
  league: LeagueState;
  currentPlayers: PlayerRecord[];
  historicalPlayers: HistoricalPlayerRecord[];
  origins: PlayerOrigin[];
}) => {
  const identities = [...currentPlayers, ...historicalPlayers];
  const identityIds = new Set(identities.map(player => player.id));
  const teamIds = new Set(league.teams.map(team => team.id));
  const originIds = new Set<number>();
  for (const origin of origins) {
    if (
      !isPlayerOrigin(origin) ||
      originIds.has(origin.playerId) ||
      !identityIds.has(origin.playerId) ||
      !teamIds.has(origin.originalTeamId) ||
      origin.acquisitionYear < league.info.startYear ||
      origin.acquisitionYear > league.info.currentYear ||
      (origin.kind === 'initial_roster' &&
        origin.acquisitionYear !== league.info.startYear)
    ) {
      throw new Error('Saved player origins do not match the current data model.');
    }
    originIds.add(origin.playerId);
  }
  if (
    origins.length !== identities.length ||
    identities.some(player => !originIds.has(player.id))
  ) {
    throw new Error('Every player identity must have exactly one origin.');
  }
};

export const getPlayerOrigin = async (playerId: number) =>
  (await getDb()).get('playerOrigins', playerId);
