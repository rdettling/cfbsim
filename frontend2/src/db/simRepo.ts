import { getDb, type GameRecord, type DriveRecord, type PlayRecord, type GameLogRecord, type PlayerRecord } from './db';

export const clearSimArtifacts = async () => {
  const db = await getDb();
  const tx = db.transaction(['games', 'drives', 'plays', 'gameLogs'], 'readwrite');
  await Promise.all([
    tx.objectStore('games').clear(),
    tx.objectStore('drives').clear(),
    tx.objectStore('plays').clear(),
    tx.objectStore('gameLogs').clear(),
    tx.done,
  ]);
};

export const clearAllSimData = async () => {
  const db = await getDb();
  const tx = db.transaction(['games', 'drives', 'plays', 'gameLogs', 'players'], 'readwrite');
  await Promise.all([
    tx.objectStore('games').clear(),
    tx.objectStore('drives').clear(),
    tx.objectStore('plays').clear(),
    tx.objectStore('gameLogs').clear(),
    tx.objectStore('players').clear(),
    tx.done,
  ]);
};

export const clearPlayers = async () => {
  const db = await getDb();
  const tx = db.transaction('players', 'readwrite');
  await tx.store.clear();
  await tx.done;
};

export const saveGames = async (games: GameRecord[]) => {
  const db = await getDb();
  const tx = db.transaction('games', 'readwrite');
  for (const game of games) {
    tx.store.put(game);
  }
  await tx.done;
};

export const getAllGames = async () => {
  const db = await getDb();
  return db.getAll('games');
};

export const getGamesByWeek = async (week: number) => {
  const db = await getDb();
  return db.getAllFromIndex('games', 'weekPlayed', week);
};

export const getGameById = async (gameId: number) => {
  const db = await getDb();
  return db.get('games', gameId);
};

export const saveDrives = async (drives: DriveRecord[]) => {
  if (!drives.length) return;
  const db = await getDb();
  const tx = db.transaction('drives', 'readwrite');
  for (const drive of drives) {
    tx.store.put(drive);
  }
  await tx.done;
};

export const savePlays = async (plays: PlayRecord[]) => {
  if (!plays.length) return;
  const db = await getDb();
  const tx = db.transaction('plays', 'readwrite');
  for (const play of plays) {
    tx.store.put(play);
  }
  await tx.done;
};

export const saveGameLogs = async (logs: GameLogRecord[]) => {
  if (!logs.length) return;
  const db = await getDb();
  const tx = db.transaction('gameLogs', 'readwrite');
  for (const log of logs) {
    tx.store.put(log);
  }
  await tx.done;
};

export const savePlayers = async (players: PlayerRecord[]) => {
  if (!players.length) return;
  const db = await getDb();
  const tx = db.transaction('players', 'readwrite');
  for (const player of players) {
    tx.store.put(player);
  }
  await tx.done;
};

export const getPlayersByTeam = async (teamId: number) => {
  const db = await getDb();
  return db.getAllFromIndex('players', 'teamId', teamId);
};

export const getAllPlayers = async () => {
  const db = await getDb();
  return db.getAll('players');
};

export const getAllPlays = async () => {
  const db = await getDb();
  return db.getAll('plays');
};

export const getAllGameLogs = async () => {
  const db = await getDb();
  return db.getAll('gameLogs');
};

export const getDrivesByGame = async (gameId: number) => {
  const db = await getDb();
  return db.getAllFromIndex('drives', 'gameId', gameId);
};

export const getPlaysByGame = async (gameId: number) => {
  const db = await getDb();
  return db.getAllFromIndex('plays', 'gameId', gameId);
};
