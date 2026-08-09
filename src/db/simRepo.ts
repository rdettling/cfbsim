import { getDb } from './db';
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
import type { NewsItem } from '../types/news';
import { flattenGameDetail } from '../domain/league/gameDetails';

export const clearCurrentGameDetails = async (year: number) => {
  const db = await getDb();
  const tx = db.transaction('gameDetails', 'readwrite');
  const keys = await tx.store.index('year').getAllKeys(year);
  await Promise.all(keys.map(key => tx.store.delete(key)));
  await tx.done;
};

export const saveGames = async (games: GameRecord[]) => {
  const db = await getDb();
  const tx = db.transaction('games', 'readwrite');
  for (const game of games) await tx.store.put(game);
  await tx.done;
};

export const saveGamesAndLeague = async (
  games: GameRecord[],
  league: LeagueState,
  newsItems: NewsItem[] = [],
) => {
  const db = await getDb();
  const tx = db.transaction(['games', 'league', 'newsItems'], 'readwrite');
  try {
    for (const game of games) await tx.objectStore('games').put(game);
    for (const item of newsItems) await tx.objectStore('newsItems').put(item);
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* The failed request may already have aborted. */ }
    try { await tx.done; } catch { /* Expected after abort. */ }
    throw error;
  }
};

export const deleteGameAndSaveLeague = async (
  gameId: number,
  league: LeagueState,
) => {
  const db = await getDb();
  const tx = db.transaction(['games', 'league'], 'readwrite');
  await tx.objectStore('games').delete(gameId);
  await tx.objectStore('league').put({ key: 'current', value: league });
  await tx.done;
};

export const getAllGames = async () => (await getDb()).getAll('games');
export const getGamesByYear = async (year: number) =>
  (await getDb()).getAllFromIndex('games', 'year', year);
export const getGamesByTeam = async (teamId: number) => {
  const db = await getDb();
  const [asTeamA, asTeamB] = await Promise.all([
    db.getAllFromIndex('games', 'teamAId', teamId),
    db.getAllFromIndex('games', 'teamBId', teamId),
  ]);
  return [...asTeamA, ...asTeamB].sort((left, right) => left.id - right.id);
};
export const getGamesByWeek = async (week: number) =>
  (await getDb()).getAllFromIndex('games', 'weekPlayed', week);
export const getGameById = async (gameId: number) =>
  (await getDb()).get('games', gameId);

export const saveGameDetails = async (details: GameDetailRecord[]) => {
  if (!details.length) return;
  const db = await getDb();
  const tx = db.transaction('gameDetails', 'readwrite');
  for (const detail of details) await tx.store.put(detail);
  await tx.done;
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
  const db = await getDb();
  const tx = db.transaction(['league', 'games', 'gameDetails', 'newsItems'], 'readwrite');
  try {
    const gameStore = tx.objectStore('games');
    const detailStore = tx.objectStore('gameDetails');
    for (const game of games) await gameStore.put(game);
    for (const detail of details) await detailStore.put(detail);
    const newsStore = tx.objectStore('newsItems');
    for (const item of newsItems) await newsStore.put(item);
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // A failed request may already have aborted the transaction.
    }
    try {
      await tx.done;
    } catch {
      // Expected after abort.
    }
    throw error;
  }
};
export const getGameDetail = async (gameId: number) =>
  (await getDb()).get('gameDetails', gameId);
export const getGameDetailsByYear = async (year: number) =>
  (await getDb()).getAllFromIndex('gameDetails', 'year', year);
export const getAllGameDetails = async () => (await getDb()).getAll('gameDetails');
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

export const savePlayers = async (players: PlayerRecord[]) => {
  if (!players.length) return;
  const db = await getDb();
  const tx = db.transaction('players', 'readwrite');
  for (const player of players) await tx.store.put(player);
  await tx.done;
};
export const getPlayersByTeam = async (teamId: number) =>
  (await getDb()).getAllFromIndex('players', 'teamId', teamId);
export const getAllPlayers = async () => (await getDb()).getAll('players');

export const getPlayerSeasons = async (playerId: number) =>
  (await getDb()).getAllFromIndex('playerSeasons', 'playerId', playerId);
export const getPlayerSeasonsByYear = async (year: number) =>
  (await getDb()).getAllFromIndex('playerSeasons', 'year', year);
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
