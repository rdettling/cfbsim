import type {
  GameRecord,
  HistoricalPlayerRecord,
  PlayerRecord,
  PlayerSeasonStats,
} from '../types/db';
import {
  SeasonMemoryDataIntegrityError,
  type SeasonAwardWinner,
  type SeasonBowlArchive,
  type SeasonConferenceChampion,
  type SeasonMemory,
  type SeasonPlayoffArchive,
  type SeasonPostseasonArchive,
  type SeasonTeamSnapshot,
} from '../types/memory';
import type { LeagueState } from '../types/league';
import {
  getArchivedPlayoffGameIds,
  getArchivedPostseasonGameType,
} from '../domain/league/postseasonArchive';
import { getDb } from './db';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const isId = (value: unknown) => Number.isInteger(value) && Number(value) > 0;

const PLAYOFF_GAME_KEYS = {
  2: ['championship'],
  4: ['leftSemifinal', 'rightSemifinal', 'championship'],
  12: [
    'leftFirstRound1',
    'leftFirstRound2',
    'rightFirstRound1',
    'rightFirstRound2',
    'leftQuarterfinal1',
    'leftQuarterfinal2',
    'rightQuarterfinal1',
    'rightQuarterfinal2',
    'leftSemifinal',
    'rightSemifinal',
    'championship',
  ],
} as const;

const matchupKey = (teamAId: number, teamBId: number) =>
  teamAId < teamBId ? `${teamAId}:${teamBId}` : `${teamBId}:${teamAId}`;

const assertMatchup = (
  gameById: Map<number, GameRecord>,
  gameId: number,
  teamAId: number,
  teamBId: number,
) => {
  const game = gameById.get(gameId);
  if (!game || matchupKey(game.teamAId, game.teamBId) !== matchupKey(teamAId, teamBId)) {
    throw new SeasonMemoryDataIntegrityError();
  }
  return game;
};

const assertPlayoffBracket = (
  playoff: SeasonPlayoffArchive,
  gameById: Map<number, GameRecord>,
) => {
  const seeds = playoff.seeds;
  if (playoff.format === 2) {
    assertMatchup(gameById, playoff.games.championship, seeds[0], seeds[1]);
    return;
  }
  if (playoff.format === 4) {
    const left = assertMatchup(gameById, playoff.games.leftSemifinal, seeds[0], seeds[3]);
    const right = assertMatchup(gameById, playoff.games.rightSemifinal, seeds[1], seeds[2]);
    assertMatchup(
      gameById,
      playoff.games.championship,
      left.winnerId!,
      right.winnerId!,
    );
    return;
  }
  const games = playoff.games;
  const leftFirst1 = assertMatchup(gameById, games.leftFirstRound1, seeds[7], seeds[8]);
  const leftFirst2 = assertMatchup(gameById, games.leftFirstRound2, seeds[4], seeds[11]);
  const rightFirst1 = assertMatchup(gameById, games.rightFirstRound1, seeds[6], seeds[9]);
  const rightFirst2 = assertMatchup(gameById, games.rightFirstRound2, seeds[5], seeds[10]);
  const leftQuarter1 = assertMatchup(gameById, games.leftQuarterfinal1, seeds[0], leftFirst1.winnerId!);
  const leftQuarter2 = assertMatchup(gameById, games.leftQuarterfinal2, seeds[3], leftFirst2.winnerId!);
  const rightQuarter1 = assertMatchup(gameById, games.rightQuarterfinal1, seeds[1], rightFirst1.winnerId!);
  const rightQuarter2 = assertMatchup(gameById, games.rightQuarterfinal2, seeds[2], rightFirst2.winnerId!);
  const leftSemi = assertMatchup(gameById, games.leftSemifinal, leftQuarter1.winnerId!, leftQuarter2.winnerId!);
  const rightSemi = assertMatchup(gameById, games.rightSemifinal, rightQuarter1.winnerId!, rightQuarter2.winnerId!);
  assertMatchup(gameById, games.championship, leftSemi.winnerId!, rightSemi.winnerId!);
};

const isPlayoff = (value: unknown): value is SeasonPlayoffArchive => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'format',
      'seeds',
      'autobids',
      'conferenceChampionsReceiveTopSeeds',
      'games',
    ]) ||
    (value.format !== 2 && value.format !== 4 && value.format !== 12) ||
    !Array.isArray(value.seeds) ||
    value.seeds.length !== value.format ||
    !value.seeds.every(isId) ||
    new Set(value.seeds).size !== value.seeds.length ||
    !Number.isInteger(value.autobids) ||
    Number(value.autobids) < 0 ||
    Number(value.autobids) > value.format ||
    typeof value.conferenceChampionsReceiveTopSeeds !== 'boolean'
  ) return false;
  const games = value.games;
  if (!isRecord(games)) return false;
  const keys = PLAYOFF_GAME_KEYS[value.format];
  return (
    hasExactKeys(games, keys) &&
    keys.every(key => isId(games[key])) &&
    new Set(keys.map(key => games[key])).size === keys.length
  );
};

const isConferenceChampion = (
  value: unknown,
): value is SeasonConferenceChampion =>
  isRecord(value) &&
  hasExactKeys(value, ['conferenceName', 'teamId', 'championshipGameId']) &&
  typeof value.conferenceName === 'string' &&
  value.conferenceName.trim().length > 0 &&
  isId(value.teamId) &&
  (value.championshipGameId === null || isId(value.championshipGameId));

const isBowl = (value: unknown): value is SeasonBowlArchive =>
  isRecord(value) &&
  hasExactKeys(value, ['gameId', 'name', 'tier']) &&
  isId(value.gameId) &&
  typeof value.name === 'string' &&
  value.name.trim().length > 0 &&
  (value.tier === 'ny6' || value.tier === 'other');

const isPostseason = (value: unknown): value is SeasonPostseasonArchive =>
  isRecord(value) &&
  hasExactKeys(value, ['playoff', 'conferenceChampions', 'bowls']) &&
  isPlayoff(value.playoff) &&
  Array.isArray(value.conferenceChampions) &&
  value.conferenceChampions.every(isConferenceChampion) &&
  new Set(value.conferenceChampions.map(entry => entry.conferenceName)).size ===
    value.conferenceChampions.length &&
  Array.isArray(value.bowls) &&
  value.bowls.every(isBowl) &&
  new Set(value.bowls.map(entry => entry.gameId)).size === value.bowls.length;

const isAward = (value: unknown): value is SeasonAwardWinner =>
  isRecord(value) &&
  hasExactKeys(value, ['categorySlug', 'playerId', 'teamId']) &&
  typeof value.categorySlug === 'string' &&
  value.categorySlug.length > 0 &&
  Number.isInteger(value.playerId) &&
  Number.isInteger(value.teamId);

const TEAM_TOTAL_KEYS = [
  'games',
  'points',
  'pass_completions',
  'pass_attempts',
  'pass_yards',
  'pass_touchdowns',
  'rush_attempts',
  'rush_yards',
  'rush_touchdowns',
  'plays',
  'first_downs_pass',
  'first_downs_rush',
  'fumbles',
  'interceptions',
] as const;

const isTeamTotals = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, TEAM_TOTAL_KEYS) &&
  TEAM_TOTAL_KEYS.every(key => Number.isInteger(value[key])) &&
  TEAM_TOTAL_KEYS.every(key =>
    key === 'pass_yards' || key === 'rush_yards' || Number(value[key]) >= 0,
  );

const isTeamSnapshot = (value: unknown): value is SeasonTeamSnapshot =>
  isRecord(value) &&
  hasExactKeys(value, [
    'teamId',
    'conference',
    'rating',
    'prestige',
    'ranking',
    'record',
    'offense',
    'defense',
  ]) &&
  Number.isInteger(value.teamId) &&
  typeof value.conference === 'string' &&
  value.conference.trim().length > 0 &&
  Number.isInteger(value.rating) &&
  typeof value.prestige === 'number' &&
  Number.isInteger(value.prestige) &&
  value.prestige >= 0 &&
  value.prestige <= 7 &&
  typeof value.ranking === 'number' &&
  Number.isInteger(value.ranking) &&
  value.ranking > 0 &&
  typeof value.record === 'string' &&
  value.record.trim().length > 0 &&
  isTeamTotals(value.offense) &&
  isTeamTotals(value.defense);

export function assertCurrentSeasonMemory(
  value: unknown,
): asserts value is SeasonMemory {
  const valid =
    isRecord(value) &&
    hasExactKeys(value, ['year', 'teamSnapshots', 'postseason', 'awards']) &&
    Number.isInteger(value.year) &&
    Array.isArray(value.teamSnapshots) &&
    value.teamSnapshots.every(isTeamSnapshot) &&
    new Set(value.teamSnapshots.map(snapshot => snapshot.teamId)).size ===
      value.teamSnapshots.length &&
    isPostseason(value.postseason) &&
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
    const snapshotTeamIds = new Set(memory.teamSnapshots.map(snapshot => snapshot.teamId));
    const participantTeamIds = new Set(
      games
        .filter(game => game.year === memory.year)
        .flatMap(game => [game.teamAId, game.teamBId]),
    );
    if (
      memory.teamSnapshots.some(snapshot => !teamIds.has(snapshot.teamId)) ||
      [...participantTeamIds].some(teamId => !snapshotTeamIds.has(teamId))
    ) {
      throw new SeasonMemoryDataIntegrityError();
    }
    const playoffGameIds = getArchivedPlayoffGameIds(memory.postseason.playoff);
    const conferenceGameIds = memory.postseason.conferenceChampions.flatMap(entry =>
      entry.championshipGameId === null ? [] : [entry.championshipGameId]
    );
    const bowlGameIds = memory.postseason.bowls.map(entry => entry.gameId);
    const archiveGameIds = [...playoffGameIds, ...conferenceGameIds, ...bowlGameIds];
    if (
      new Set(archiveGameIds).size !== archiveGameIds.length ||
      memory.postseason.playoff.seeds.some(teamId => !snapshotTeamIds.has(teamId))
    ) {
      throw new SeasonMemoryDataIntegrityError();
    }
    for (const gameId of archiveGameIds) {
      const game = gameById.get(gameId);
      if (!game || game.year !== memory.year || game.winnerId === null) {
        throw new SeasonMemoryDataIntegrityError();
      }
    }
    for (const gameId of playoffGameIds) {
      const game = gameById.get(gameId)!;
      if (game.gameType !== getArchivedPostseasonGameType(memory, gameId)) {
        throw new SeasonMemoryDataIntegrityError();
      }
    }
    assertPlayoffBracket(memory.postseason.playoff, gameById);
    for (const champion of memory.postseason.conferenceChampions) {
      const game = champion.championshipGameId === null
        ? null
        : gameById.get(champion.championshipGameId);
      if (
        !snapshotTeamIds.has(champion.teamId) ||
        (game && game.winnerId !== champion.teamId)
      ) {
        throw new SeasonMemoryDataIntegrityError();
      }
    }
    for (const bowl of memory.postseason.bowls) {
      if (gameById.get(bowl.gameId)?.gameType !== 'bowl') {
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
