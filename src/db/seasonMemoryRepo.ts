import type {
  GameRecord,
  HistoricalPlayerRecord,
  PlayerRecord,
  PlayerSeasonStats,
} from '../types/db';
import {
  SEASON_MEMORY_EVENT_TYPES,
  SeasonMemoryDataIntegrityError,
  type SeasonAwardWinner,
  type SeasonMemory,
  type SeasonMemoryEvent,
} from '../types/memory';
import type { LeagueState } from '../types/league';
import { getDb } from './db';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const isEvent = (value: unknown): value is SeasonMemoryEvent => {
  if (!isRecord(value) || !SEASON_MEMORY_EVENT_TYPES.includes(value.type as never)) {
    return false;
  }
  if (!Number.isInteger(value.gameId)) return false;
  if (value.type === 'conference_championship') {
    return (
      hasExactKeys(value, ['type', 'gameId', 'conferenceName']) &&
      typeof value.conferenceName === 'string' &&
      value.conferenceName.length > 0
    );
  }
  if (value.type === 'bowl') {
    return (
      hasExactKeys(value, ['type', 'gameId', 'bowlName']) &&
      typeof value.bowlName === 'string' &&
      value.bowlName.length > 0
    );
  }
  return hasExactKeys(value, ['type', 'gameId']);
};

const isAward = (value: unknown): value is SeasonAwardWinner =>
  isRecord(value) &&
  hasExactKeys(value, ['categorySlug', 'playerId', 'teamId']) &&
  typeof value.categorySlug === 'string' &&
  value.categorySlug.length > 0 &&
  Number.isInteger(value.playerId) &&
  Number.isInteger(value.teamId);

export function assertCurrentSeasonMemory(
  value: unknown,
): asserts value is SeasonMemory {
  const valid =
    isRecord(value) &&
    hasExactKeys(value, ['year', 'playoffTeams', 'events', 'awards']) &&
    Number.isInteger(value.year) &&
    (value.playoffTeams === 2 ||
      value.playoffTeams === 4 ||
      value.playoffTeams === 12) &&
    Array.isArray(value.events) &&
    value.events.every(isEvent) &&
    new Set(value.events.map(event => event.gameId)).size === value.events.length &&
    Array.isArray(value.awards) &&
    value.awards.every(isAward) &&
    new Set(value.awards.map(award => award.categorySlug)).size === value.awards.length;
  if (!valid) throw new SeasonMemoryDataIntegrityError();
}

export const assertSeasonMemoryReferences = (
  memories: SeasonMemory[],
  league: LeagueState,
  games: GameRecord[],
  players: PlayerRecord[],
  historicalPlayers: HistoricalPlayerRecord[],
  playerSeasons: PlayerSeasonStats[],
) => {
  const gameById = new Map(games.map(game => [game.id, game]));
  const playerIds = new Set([
    ...players.map(player => player.id),
    ...historicalPlayers.map(player => player.id),
  ]);
  const seasonKeys = new Set(
    playerSeasons.map(season => `${season.year}:${season.playerId}:${season.teamId}`),
  );
  const teamIds = new Set(league.teams.map(team => team.id));
  const years = new Set<number>();
  for (const memory of memories) {
    assertCurrentSeasonMemory(memory);
    if (
      years.has(memory.year) ||
      memory.year < league.info.startYear ||
      memory.year > league.info.currentYear
    ) {
      throw new SeasonMemoryDataIntegrityError();
    }
    years.add(memory.year);
    for (const event of memory.events) {
      const game = gameById.get(event.gameId);
      if (!game || game.year !== memory.year || game.winnerId === null) {
        throw new SeasonMemoryDataIntegrityError();
      }
    }
    for (const award of memory.awards) {
      if (
        !playerIds.has(award.playerId) ||
        !seasonKeys.has(`${memory.year}:${award.playerId}:${award.teamId}`) ||
        !teamIds.has(award.teamId)
      ) {
        throw new SeasonMemoryDataIntegrityError();
      }
    }
  }
};

export const getAllSeasonMemories = async () => {
  const db = await getDb();
  const memories = await db.getAll('seasonMemories');
  memories.forEach(assertCurrentSeasonMemory);
  return memories.sort((left, right) => right.year - left.year);
};

export const getSeasonMemory = async (year: number) => {
  const db = await getDb();
  const memory = await db.get('seasonMemories', year);
  if (memory) assertCurrentSeasonMemory(memory);
  return memory;
};
