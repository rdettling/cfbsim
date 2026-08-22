import { getDb } from './db';
import {
  assertCurrentLeagueState,
  assertCurrentRosterState,
} from './leagueStateValidation';
import type {
  DriveRecord,
  GameDetailRecord,
  GameLogRecord,
  GameRecord,
  HistoricalPlayerRecord,
  PlayerRecord,
  PlayerSeasonStats,
  PlayRecord,
} from '../types/db';
import type { LeagueState } from '../types/league';
import type { SeasonMemory } from '../types/memory';
import type { NewsItem } from '../types/news';
import { flattenGameDetail } from '../domain/league/gameDetails';
import {
  assertCurrentGameRecord,
  assertCurrentGameRecords,
  assertLeagueGameRecords,
} from './gameRecordValidation';
import {
  assertCurrentGameDetailRecord,
  assertCurrentGameDetailRecords,
  assertGameDetailReferences,
} from './gameDetailValidation';
import { assertCurrentSeasonMemory, assertSeasonMemoryReferences } from './seasonMemoryRepo';
import { assertHistoricalIntegrity } from './historyRepo';

const abortTransaction = async (tx: { abort: () => void; done: Promise<unknown> }) => {
  try { tx.abort(); } catch { /* The failed request may already have aborted. */ }
  try { await tx.done; } catch { /* Expected after abort. */ }
};

export const commitSeasonInitialization = async ({
  year,
  league,
  games,
  newsItems = [],
}: {
  year: number;
  league: LeagueState;
  games: GameRecord[];
  newsItems?: NewsItem[];
}) => {
  assertCurrentLeagueState(league);
  assertLeagueGameRecords(league, games);
  const db = await getDb();
  const tx = db.transaction(['league', 'games', 'gameDetails', 'newsItems'], 'readwrite');
  try {
    const detailStore = tx.objectStore('gameDetails');
    const detailKeys = await detailStore.index('year').getAllKeys(year);
    for (const key of detailKeys) await detailStore.delete(key);
    const gameStore = tx.objectStore('games');
    for (const game of games) await gameStore.put(game);
    const newsStore = tx.objectStore('newsItems');
    for (const item of newsItems) await newsStore.put(item);
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const saveGamesAndLeague = async (
  games: GameRecord[],
  league: LeagueState,
  newsItems: NewsItem[] = [],
) => {
  assertCurrentLeagueState(league);
  assertLeagueGameRecords(league, games);
  const db = await getDb();
  const tx = db.transaction(['games', 'league', 'newsItems'], 'readwrite');
  try {
    for (const game of games) await tx.objectStore('games').put(game);
    for (const item of newsItems) await tx.objectStore('newsItems').put(item);
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const deleteGameAndSaveLeague = async (
  gameId: number,
  league: LeagueState,
) => {
  assertCurrentLeagueState(league);
  const db = await getDb();
  const tx = db.transaction(['games', 'league'], 'readwrite');
  await tx.objectStore('games').delete(gameId);
  await tx.objectStore('league').put({ key: 'current', value: league });
  await tx.done;
};

export const getAllGames = async () => {
  const games = await (await getDb()).getAll('games');
  assertCurrentGameRecords(games);
  return games;
};
export const getGamesByYear = async (year: number) => {
  const games = await (await getDb()).getAllFromIndex('games', 'year', year);
  assertCurrentGameRecords(games);
  return games;
};
export const getGamesByTeam = async (teamId: number) => {
  const db = await getDb();
  const [asTeamA, asTeamB] = await Promise.all([
    db.getAllFromIndex('games', 'teamAId', teamId),
    db.getAllFromIndex('games', 'teamBId', teamId),
  ]);
  const games = [...asTeamA, ...asTeamB].sort((left, right) => left.id - right.id);
  assertCurrentGameRecords(games);
  return games;
};
export const getGamesByWeek = async (week: number) => {
  const games = await (await getDb()).getAllFromIndex('games', 'weekPlayed', week);
  assertCurrentGameRecords(games);
  return games;
};
export const getGameById = async (gameId: number) => {
  const game = await (await getDb()).get('games', gameId);
  if (game !== undefined) assertCurrentGameRecord(game);
  return game;
};

export const commitSimulationBatch = async ({
  league,
  games,
  details,
  newsItems = [],
}: {
  league: LeagueState;
  games: GameRecord[];
  details: GameDetailRecord[];
  newsItems?: NewsItem[];
}) => {
  assertCurrentLeagueState(league);
  assertLeagueGameRecords(league, games);
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'games', 'gameDetails', 'newsItems', 'players'],
    'readwrite',
  );
  try {
    const players = await tx.objectStore('players').getAll();
    assertCurrentRosterState(league, players);
    assertGameDetailReferences({
      details,
      games,
      currentPlayers: players,
    });
    const gameStore = tx.objectStore('games');
    const detailStore = tx.objectStore('gameDetails');
    for (const game of games) await gameStore.put(game);
    for (const detail of details) await detailStore.put(detail);
    const newsStore = tx.objectStore('newsItems');
    for (const item of newsItems) await newsStore.put(item);
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};

export const commitSeasonCompletion = async ({
  league,
  memory,
  playerSeasons,
}: {
  league: LeagueState;
  memory: SeasonMemory;
  playerSeasons: PlayerSeasonStats[];
}) => {
  if (league.info.stage !== 'summary' || memory.year !== league.info.currentYear) {
    throw new Error('Completed-season artifacts do not match the summary league.');
  }
  assertCurrentLeagueState(league);
  assertCurrentSeasonMemory(memory);

  const db = await getDb();
  const tx = db.transaction(
    [
      'league',
      'games',
      'players',
      'historicalPlayers',
      'seasonMemories',
      'playerSeasons',
    ],
    'readwrite',
  );
  try {
    const [persisted, games, players, historicalPlayers, memories, seasons] =
      await Promise.all([
        tx.objectStore('league').get('current'),
        tx.objectStore('games').getAll(),
        tx.objectStore('players').getAll(),
        tx.objectStore('historicalPlayers').getAll(),
        tx.objectStore('seasonMemories').getAll(),
        tx.objectStore('playerSeasons').getAll(),
      ]);
    if (!persisted) {
      throw new Error('No league found. Start a new game from the Home page.');
    }
    assertCurrentLeagueState(persisted.value);
    const persistedLeague = persisted.value;
    if (
      persistedLeague.info.stage !== 'season' ||
      persistedLeague.info.currentYear !== league.info.currentYear ||
      persistedLeague.playoff.natty !== league.playoff.natty
    ) {
      throw new Error('The persisted league is no longer ready for season completion.');
    }
    const championship = games.find(game => game.id === league.playoff.natty);
    if (
      !championship ||
      championship.year !== league.info.currentYear ||
      championship.gameType !== 'national_championship' ||
      championship.winnerId === null
    ) {
      throw new Error('The national championship is not complete.');
    }
    if (games.some(game =>
      game.year === league.info.currentYear && game.winnerId === null
    )) {
      throw new Error('The current season has unfinished games.');
    }
    if (
      memories.some(existing => existing.year === memory.year) ||
      seasons.some(season => season.year === memory.year)
    ) {
      throw new Error(`Completed-season artifacts already exist for ${memory.year}.`);
    }

    assertLeagueGameRecords(league, games);
    assertCurrentRosterState(league, players);
    assertHistoricalIntegrity({
      currentPlayers: players,
      historicalPlayers,
      playerSeasons: [...seasons, ...playerSeasons],
    });
    assertSeasonMemoryReferences(
      [...memories, memory],
      league,
      games,
      players,
      historicalPlayers,
      [...seasons, ...playerSeasons],
    );

    await tx.objectStore('seasonMemories').put(memory);
    const playerSeasonStore = tx.objectStore('playerSeasons');
    for (const season of playerSeasons) await playerSeasonStore.put(season);
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
  } catch (error) {
    await abortTransaction(tx);
    throw error;
  }
};
export const getGameDetail = async (gameId: number) => {
  const detail = await (await getDb()).get('gameDetails', gameId);
  if (detail !== undefined) assertCurrentGameDetailRecord(detail);
  return detail;
};
export const getGameDetailsByYear = async (year: number) => {
  const details = await (await getDb()).getAllFromIndex('gameDetails', 'year', year);
  assertCurrentGameDetailRecords(details);
  return details;
};
export const getAllGameDetails = async () => {
  const details = await (await getDb()).getAll('gameDetails');
  assertCurrentGameDetailRecords(details);
  return details;
};
export const getAllPlays = async (): Promise<PlayRecord[]> =>
  (await getAllGameDetails()).flatMap(detail => flattenGameDetail(detail).plays);
export const getDrivesByGame = async (gameId: number): Promise<DriveRecord[]> => {
  const detail = await getGameDetail(gameId);
  return detail ? flattenGameDetail(detail).drives : [];
};
export const getPlaysByGame = async (gameId: number): Promise<PlayRecord[]> => {
  const detail = await getGameDetail(gameId);
  return detail ? flattenGameDetail(detail).plays : [];
};

export const getPlayersByTeam = async (teamId: number) =>
  (await getDb()).getAllFromIndex('players', 'teamId', teamId);
export const getAllPlayers = async () => (await getDb()).getAll('players');

export const getPlayerSeasons = async (playerId: number) =>
  (await getDb()).getAllFromIndex('playerSeasons', 'playerId', playerId);
export const getPlayerSeasonsByYear = async (year: number) =>
  (await getDb()).getAllFromIndex('playerSeasons', 'year', year);
export const getPlayerSeasonsByYearTeam = async (year: number, teamId: number) =>
  (await getDb()).getAllFromIndex('playerSeasons', 'yearTeamId', [year, teamId]);
export const getAllPlayerSeasons = async () => (await getDb()).getAll('playerSeasons');
export const getHistoricalPlayer = async (playerId: number) =>
  (await getDb()).get('historicalPlayers', playerId);
export const getAllHistoricalPlayers = async () =>
  (await getDb()).getAll('historicalPlayers');

// Read-only flat projections keep simulation/stat presentation code simple.
export const getAllGameLogs = async (): Promise<GameLogRecord[]> =>
  (await getAllGameDetails()).flatMap(detail =>
    detail.playerStats.map(log => ({ ...log, gameId: detail.gameId })),
  );
export const getGameLogsByYear = async (year: number): Promise<GameLogRecord[]> =>
  (await getGameDetailsByYear(year)).flatMap(detail =>
    detail.playerStats.map(log => ({ ...log, gameId: detail.gameId })),
  );

export type PlayerIdentity = PlayerRecord | HistoricalPlayerRecord;
export type PersistedPlayerSeason = PlayerSeasonStats;
