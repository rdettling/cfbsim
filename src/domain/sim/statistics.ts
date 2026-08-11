import { getPlayersByTeam } from '../../db/simRepo';
import type {
  GameLogRecord,
  PlayParticipants,
  PlayerRecord,
  PlayRecord,
} from '../../types/db';
import type { Team } from '../../types/domain';
import type { SimGame, StartersCache } from '../../types/sim';

const createEmptyLog = (player: PlayerRecord, gameId: number): GameLogRecord => ({
  playerId: player.id,
  gameId,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
});

const requiredParticipantId = (
  play: PlayRecord,
  role: keyof PlayParticipants,
) => {
  const playerId = play.participants[role];
  if (playerId === null) throw new Error(`Play ${play.id} is missing ${role}.`);
  return playerId;
};

export const createGameLogsFromPlays = (
  game: SimGame,
  plays: PlayRecord[],
  starters: StartersCache,
) => {
  const desiredPositions = new Set(['qb', 'rb', 'wr', 'te', 'k', 'p', 'dl', 'lb', 'cb', 's']);
  const logs = [...starters.byId.values()]
    .filter(player =>
      (player.teamId === game.teamA.id || player.teamId === game.teamB.id)
      && player.starter
      && desiredPositions.has(player.pos),
    )
    .sort((left, right) => left.id - right.id)
    .map(player => createEmptyLog(player, game.id));
  const logByPlayerId = new Map(logs.map(log => [log.playerId, log]));
  const requiredLog = (play: PlayRecord, role: keyof PlayParticipants) => {
    const playerId = requiredParticipantId(play, role);
    const log = logByPlayerId.get(playerId);
    if (!log) throw new Error(`Play ${play.id} references unlogged ${role} ${playerId}.`);
    return log;
  };
  const optionalLog = (play: PlayRecord, role: keyof PlayParticipants) => {
    const playerId = play.participants[role];
    if (playerId === null) return null;
    const log = logByPlayerId.get(playerId);
    if (!log) throw new Error(`Play ${play.id} references unlogged ${role} ${playerId}.`);
    return log;
  };

  for (const play of plays) {
    if (play.call.kind === 'try') {
      if (play.call.attempt === 'extra_point') {
        const kicker = requiredLog(play, 'kickerId');
        kicker.extra_points_attempted += 1;
        if (play.result === 'made extra point') kicker.extra_points_made += 1;
      }
      continue;
    }
    if (play.playType === 'run') {
      const runner = requiredLog(play, 'rusherId');
      runner.rush_attempts += 1;
      runner.rush_yards += play.yardsGained;
      if (play.result === 'touchdown') runner.rush_touchdowns += 1;
      if (play.result === 'fumble') runner.fumbles += 1;
      const tackler = optionalLog(play, 'tacklerId');
      if (tackler) tackler.tackles += 1;
      if (play.result === 'fumble') {
        requiredLog(play, 'forcedFumbleById').fumbles_forced += 1;
        requiredLog(play, 'fumbleRecoveryById').fumbles_recovered += 1;
      }
      continue;
    }

    if (play.playType === 'pass') {
      const passer = requiredLog(play, 'passerId');
      passer.pass_attempts += 1;
      if (play.result === 'sack') {
        requiredLog(play, 'sackerId').sacks += 1;
      } else if (play.result === 'interception') {
        passer.pass_interceptions += 1;
        requiredLog(play, 'interceptorId').interceptions += 1;
      } else if (play.result === 'pass' || play.result === 'touchdown') {
        const target = requiredLog(play, 'targetId');
        passer.pass_completions += 1;
        passer.pass_yards += play.yardsGained;
        target.receiving_catches += 1;
        target.receiving_yards += play.yardsGained;
        if (play.result === 'touchdown') {
          passer.pass_touchdowns += 1;
          target.receiving_touchdowns += 1;
        }
        const tackler = optionalLog(play, 'tacklerId');
        if (tackler) tackler.tackles += 1;
      }
      continue;
    }

    if (play.playType === 'field goal') {
      const kicker = requiredLog(play, 'kickerId');
      kicker.field_goals_attempted += 1;
      if (play.result === 'made field goal') kicker.field_goals_made += 1;
    }
  }

  return logs;
};

export const buildStartersCacheFromPlayers = (players: PlayerRecord[]): StartersCache => {
  const byTeamPos = new Map<string, PlayerRecord[]>();
  const starters = players.filter(player => player.starter);
  starters.forEach(player => {
    const key = `${player.teamId}:${player.pos}`;
    const list = byTeamPos.get(key) ?? [];
    list.push(player);
    byTeamPos.set(key, list);
  });
  return {
    byTeamPos,
    byId: new Map(players.map(player => [player.id, player])),
  };
};

export const buildStartersCache = async (teams: Team[]) => {
  const players: PlayerRecord[] = [];
  for (const team of teams) {
    players.push(...await getPlayersByTeam(team.id));
  }
  return buildStartersCacheFromPlayers(players);
};

export const loadPlayersMap = async (teams: Team[]) => {
  const map = new Map<number, PlayerRecord>();
  for (const team of teams) {
    const players = await getPlayersByTeam(team.id);
    players.forEach(player => map.set(player.id, player));
  }
  return map;
};
