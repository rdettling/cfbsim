import type { GameRecord } from '../types/db';
import type { LeagueState } from '../types/league';
import { GAME_TYPES } from '../types/news';
import { GameDataIntegrityError } from './gameDataIntegrityError';

const GAME_RECORD_KEYS = [
  'id',
  'teamAId',
  'teamBId',
  'homeTeamId',
  'awayTeamId',
  'neutralSite',
  'venue',
  'winnerId',
  'baseLabel',
  'name',
  'gameType',
  'rivalryKey',
  'spreadA',
  'spreadB',
  'moneylineA',
  'moneylineB',
  'winProbA',
  'winProbB',
  'weekPlayed',
  'year',
  'rankATOG',
  'rankBTOG',
  'resultA',
  'resultB',
  'overtime',
  'quarter',
  'clockSecondsLeft',
  'scoreA',
  'scoreB',
  'watchability',
] as const;

const SECONDS_PER_QUARTER = 900;

const fail = (message: string): never => {
  throw new GameDataIntegrityError('INVALID_GAME_RECORD', message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>) => {
  const actual = Object.keys(value);
  return actual.length === GAME_RECORD_KEYS.length &&
    actual.every(key => GAME_RECORD_KEYS.includes(key as never));
};

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const isNonnegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNullableNonemptyString = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim().length > 0);

const isParticipantId = (value: unknown, teamAId: number, teamBId: number) =>
  value === teamAId || value === teamBId;

const isSpread = (value: unknown) =>
  value === 'Even' ||
  (typeof value === 'string' && /^[+-]\d+(?:\.5)?$/.test(value));

const isMoneyline = (value: unknown) =>
  typeof value === 'string' && /^[+-]\d+$/.test(value);

const hasValidSite = (
  value: Record<string, unknown>,
  teamAId: number,
  teamBId: number,
) => {
  if (typeof value.neutralSite !== 'boolean') return false;
  if (value.neutralSite) {
    return value.homeTeamId === null && value.awayTeamId === null;
  }
  return isParticipantId(value.homeTeamId, teamAId, teamBId) &&
    isParticipantId(value.awayTeamId, teamAId, teamBId) &&
    value.homeTeamId !== value.awayTeamId;
};

const hasValidOdds = (value: Record<string, unknown>) =>
  isSpread(value.spreadA) &&
  isSpread(value.spreadB) &&
  isMoneyline(value.moneylineA) &&
  isMoneyline(value.moneylineB) &&
  isFiniteNumber(value.winProbA) &&
  isFiniteNumber(value.winProbB) &&
  value.winProbA >= 0 &&
  value.winProbA <= 1 &&
  value.winProbB >= 0 &&
  value.winProbB <= 1 &&
  Math.abs(value.winProbA + value.winProbB - 1) <= 1e-9;

const isUpcomingGame = (value: Record<string, unknown>) =>
  value.winnerId === null &&
  value.resultA === null &&
  value.resultB === null &&
  value.scoreA === null &&
  value.scoreB === null &&
  value.overtime === 0 &&
  value.quarter === 1 &&
  value.clockSecondsLeft === SECONDS_PER_QUARTER;

const isCompletedGame = (
  value: Record<string, unknown>,
  teamAId: number,
  teamBId: number,
) => {
  if (
    !isParticipantId(value.winnerId, teamAId, teamBId) ||
    !isNonnegativeInteger(value.scoreA) ||
    !isNonnegativeInteger(value.scoreB) ||
    value.scoreA === value.scoreB ||
    value.quarter !== 4 ||
    value.clockSecondsLeft !== 0
  ) {
    return false;
  }
  if (value.winnerId === teamAId) {
    return value.resultA === 'W' &&
      value.resultB === 'L' &&
      value.scoreA > value.scoreB;
  }
  return value.resultA === 'L' &&
    value.resultB === 'W' &&
    value.scoreB > value.scoreA;
};

export function assertCurrentGameRecord(
  value: unknown,
): asserts value is GameRecord {
  if (!isRecord(value)) {
    fail('Saved game data must be an object.');
  }
  const record = value as Record<string, unknown>;
  if (!hasExactKeys(record)) {
    fail('Saved game data has missing or unknown fields.');
  }
  if (
    !isPositiveInteger(record.id) ||
    !isPositiveInteger(record.teamAId) ||
    !isPositiveInteger(record.teamBId) ||
    record.teamAId === record.teamBId ||
    !hasValidSite(record, record.teamAId, record.teamBId) ||
    !isNullableNonemptyString(record.venue) ||
    typeof record.baseLabel !== 'string' ||
    record.baseLabel.trim().length === 0 ||
    !isNullableNonemptyString(record.name) ||
    !GAME_TYPES.includes(record.gameType as never) ||
    !isNullableNonemptyString(record.rivalryKey) ||
    !hasValidOdds(record) ||
    !isPositiveInteger(record.weekPlayed) ||
    !isPositiveInteger(record.year) ||
    !isPositiveInteger(record.rankATOG) ||
    !isPositiveInteger(record.rankBTOG) ||
    !isNonnegativeInteger(record.overtime) ||
    !Number.isInteger(record.quarter) ||
    Number(record.quarter) < 1 ||
    Number(record.quarter) > 4 ||
    !isNonnegativeInteger(record.clockSecondsLeft) ||
    Number(record.clockSecondsLeft) > SECONDS_PER_QUARTER ||
    !isFiniteNumber(record.watchability) ||
    record.watchability < 0
  ) {
    fail('Saved game data contains an invalid field value.');
  }
  if (
    !isUpcomingGame(record) &&
    !isCompletedGame(record, record.teamAId as number, record.teamBId as number)
  ) {
    fail('Saved game data has an incoherent game state.');
  }
}

export function assertCurrentGameRecords(
  value: unknown,
): asserts value is GameRecord[] {
  if (!Array.isArray(value)) fail('Saved games must be an array.');
  const records = value as unknown[];
  records.forEach(assertCurrentGameRecord);
  const ids = (records as GameRecord[]).map(game => game.id);
  if (new Set(ids).size !== ids.length) {
    fail('Saved games contain duplicate IDs.');
  }
}

export function assertLeagueGameRecords(
  league: LeagueState,
  value: unknown,
): asserts value is GameRecord[] {
  assertCurrentGameRecords(value);
  const teamIds = new Set(league.teams.map(team => team.id));
  for (const game of value) {
    if (
      !teamIds.has(game.teamAId) ||
      !teamIds.has(game.teamBId) ||
      (game.homeTeamId !== null && !teamIds.has(game.homeTeamId)) ||
      (game.awayTeamId !== null && !teamIds.has(game.awayTeamId)) ||
      (game.winnerId !== null && !teamIds.has(game.winnerId)) ||
      game.id >= league.idCounters.game
    ) {
      fail(`Saved game ${game.id} has an invalid league reference.`);
    }
  }
}
