import type {
  DriveRecord,
  GameDetailRecord,
  GameLogRecord,
  PlayRecord,
  PlayerRecord,
  PlayerSeasonStats,
} from '../../types/db';
import type { SeasonMemory } from '../../types/memory';

export const buildGameDetail = (
  gameId: number,
  year: number,
  drives: DriveRecord[],
  plays: PlayRecord[],
  logs: GameLogRecord[],
): GameDetailRecord => {
  const playsByDrive = new Map<number, PlayRecord[]>();
  for (const play of plays) {
    const list = playsByDrive.get(play.driveId) ?? [];
    list.push(play);
    playsByDrive.set(play.driveId, list);
  }
  return {
    gameId,
    year,
    drives: [...drives]
      .sort((a, b) => a.driveNum - b.driveNum)
      .map(({ id, gameId: _gameId, ...drive }) => ({
        ...drive,
        plays: (playsByDrive.get(id) ?? [])
          .sort((a, b) => a.id - b.id)
          .map(({
            id: _playId,
            gameId: _playGameId,
            driveId: _driveId,
            offenseId: _offenseId,
            defenseId: _defenseId,
            ...play
          }) => ({
            ...play,
          })),
      })),
    playerStats: logs.map(({ gameId: _logGameId, ...log }) => log),
  };
};

export const flattenGameDetail = (detail: GameDetailRecord) => {
  const drives: DriveRecord[] = [];
  const plays: PlayRecord[] = [];
  detail.drives.forEach((drive, driveIndex) => {
    const driveId = detail.gameId * 1000 + driveIndex + 1;
    drives.push({
      ...drive,
      id: driveId,
      gameId: detail.gameId,
    });
    drive.plays.forEach((play, playIndex) => {
      plays.push({
        ...play,
        id: detail.gameId * 1_000_000 + driveIndex * 1000 + playIndex + 1,
        gameId: detail.gameId,
        driveId,
        offenseId: drive.offenseId,
        defenseId: drive.defenseId,
      });
    });
  });
  const logs: GameLogRecord[] = detail.playerStats.map(log => ({
    ...log,
    gameId: detail.gameId,
  }));
  return { drives, plays, logs };
};

const STAT_KEYS = [
  'pass_yards',
  'pass_attempts',
  'pass_completions',
  'pass_touchdowns',
  'pass_interceptions',
  'rush_yards',
  'rush_attempts',
  'rush_touchdowns',
  'receiving_yards',
  'receiving_catches',
  'receiving_touchdowns',
  'fumbles',
  'tackles',
  'sacks',
  'interceptions',
  'fumbles_forced',
  'fumbles_recovered',
  'field_goals_made',
  'field_goals_attempted',
  'extra_points_made',
  'extra_points_attempted',
] as const;

export const buildPlayerSeasons = (
  year: number,
  details: GameDetailRecord[],
  players: PlayerRecord[],
): PlayerSeasonStats[] => {
  const playersById = new Map(players.map(player => [player.id, player]));
  const totals = new Map<number, PlayerSeasonStats>();
  for (const detail of details) {
    for (const log of detail.playerStats) {
      const player = playersById.get(log.playerId);
      if (!player) throw new Error(`Game detail references missing player ${log.playerId}.`);
      let season = totals.get(player.id);
      if (!season) {
        season = {
          year,
          playerId: player.id,
          teamId: player.teamId,
          position: player.pos,
          classYear: player.year,
          rating: player.rating,
          starter: player.starter,
          games: 0,
          ...Object.fromEntries(STAT_KEYS.map(key => [key, 0])),
        } as PlayerSeasonStats;
        totals.set(player.id, season);
      }
      season.games += 1;
      for (const key of STAT_KEYS) season[key] += log[key];
    }
  }
  return [...totals.values()].sort((a, b) => a.playerId - b.playerId);
};

export const PLAYER_SEASON_STAT_KEYS = STAT_KEYS;

export const selectRetainedGameIds = (
  userTeamId: number,
  games: Array<{ id: number; teamAId: number; teamBId: number }>,
  memory: SeasonMemory,
) => {
  const retained = new Set(
    games
      .filter(game => game.teamAId === userTeamId || game.teamBId === userTeamId)
      .map(game => game.id),
  );
  for (const event of memory.events) {
    if (event.type !== 'bowl') retained.add(event.gameId);
  }
  return retained;
};
