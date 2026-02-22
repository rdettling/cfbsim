import type { Team } from '../../../types/domain';
import type { GameLogRecord, PlayRecord, PlayerRecord } from '../../../types/db';

type LeaderEntry = {
  playerId: number;
  name: string;
  pos: string;
  team: string;
  statLine: string;
};

const toLeaderEntry = (
  log: GameLogRecord,
  statLine: string,
  playersById: Map<number, PlayerRecord>,
  teamsById: Map<number, Team>
): LeaderEntry | null => {
  const player = playersById.get(log.playerId);
  if (!player) return null;
  const team = teamsById.get(player.teamId);
  return {
    playerId: player.id,
    name: `${player.first} ${player.last}`,
    pos: player.pos.toUpperCase(),
    team: team?.abbreviation || team?.name || '',
    statLine,
  };
};

const isLeaderEntry = (entry: LeaderEntry | null): entry is LeaderEntry => entry !== null;

const buildTeamStats = (teamId: number, points: number, plays: PlayRecord[]) => {
  const teamPlays = plays.filter(play => play.offenseId === teamId);
  const passPlays = teamPlays.filter(play => play.playType === 'pass');
  const runPlays = teamPlays.filter(play => play.playType === 'run');
  const passYards = passPlays.reduce((sum, play) => sum + play.yardsGained, 0);
  const rushYards = runPlays.reduce((sum, play) => sum + play.yardsGained, 0);
  const firstDowns = teamPlays.filter(play => play.yardsGained >= play.yardsLeft).length;
  const turnovers = teamPlays.filter(
    play => play.result === 'interception' || play.result === 'fumble'
  ).length;
  const thirdDownAttempts = teamPlays.filter(play => play.down === 3).length;
  const thirdDownMade = teamPlays.filter(
    play => play.down === 3 && play.yardsGained >= play.yardsLeft
  ).length;
  const thirdDownPct = thirdDownAttempts
    ? Math.round((thirdDownMade / thirdDownAttempts) * 1000) / 10
    : 0;

  return {
    points,
    totalYards: passYards + rushYards,
    passYards,
    rushYards,
    firstDowns,
    turnovers,
    plays: teamPlays.length,
    thirdDown: {
      made: thirdDownMade,
      attempts: thirdDownAttempts,
      pct: thirdDownPct,
    },
  };
};

const buildTeamBoxScore = (
  teamId: number,
  logs: GameLogRecord[],
  playersByTeam: Map<number, Set<number>>,
  playersById: Map<number, PlayerRecord>,
  teamsById: Map<number, Team>
) => {
  const teamPlayerIds = playersByTeam.get(teamId) ?? new Set<number>();
  const teamLogs = logs.filter(log => teamPlayerIds.has(log.playerId));

  const passing = teamLogs
    .filter(log => log.pass_attempts > 0)
    .sort((a, b) => b.pass_yards - a.pass_yards)
    .map(log =>
      toLeaderEntry(
        log,
        `${log.pass_yards} yds • ${log.pass_touchdowns} TD • ${log.pass_interceptions} INT`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  const rushing = teamLogs
    .filter(log => log.rush_attempts > 0)
    .sort((a, b) => b.rush_yards - a.rush_yards)
    .map(log =>
      toLeaderEntry(log, `${log.rush_yards} yds • ${log.rush_touchdowns} TD`, playersById, teamsById)
    )
    .filter(isLeaderEntry);

  const receiving = teamLogs
    .filter(log => log.receiving_catches > 0)
    .sort((a, b) => b.receiving_yards - a.receiving_yards)
    .map(log =>
      toLeaderEntry(
        log,
        `${log.receiving_yards} yds • ${log.receiving_touchdowns} TD`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  const defense = teamLogs
    .filter(log => log.tackles > 0 || log.sacks > 0 || log.interceptions > 0)
    .sort(
      (a, b) =>
        b.tackles + b.sacks * 2 + b.interceptions * 3 - (a.tackles + a.sacks * 2 + a.interceptions * 3)
    )
    .map(log =>
      toLeaderEntry(
        log,
        `${log.tackles} tk • ${log.sacks} sk • ${log.interceptions} INT`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  const kicking = teamLogs
    .filter(log => log.field_goals_attempted > 0 || log.extra_points_attempted > 0)
    .sort(
      (a, b) =>
        b.field_goals_made * 3 +
        b.extra_points_made -
        (a.field_goals_made * 3 + a.extra_points_made)
    )
    .map(log =>
      toLeaderEntry(
        log,
        `FG ${log.field_goals_made}/${log.field_goals_attempted} • XP ${log.extra_points_made}/${log.extra_points_attempted}`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  return { passing, rushing, receiving, defense, kicking };
};

export const buildGameResultSummary = (
  game: {
    teamA: Team;
    teamB: Team;
    scoreA: number;
    scoreB: number;
  },
  plays: PlayRecord[],
  logs: GameLogRecord[],
  players: PlayerRecord[],
  teamsById: Map<number, Team>
) => {
  const playersById = new Map(players.map(player => [player.id, player]));
  const playersByTeam = new Map<number, Set<number>>();
  players.forEach(player => {
    if (!playersByTeam.has(player.teamId)) playersByTeam.set(player.teamId, new Set());
    playersByTeam.get(player.teamId)!.add(player.id);
  });

  const passing = logs
    .filter(log => log.pass_attempts > 0)
    .sort((a, b) => b.pass_yards - a.pass_yards)
    .slice(0, 5)
    .map(log =>
      toLeaderEntry(
        log,
        `${log.pass_yards} yds • ${log.pass_touchdowns} TD • ${log.pass_interceptions} INT`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  const rushing = logs
    .filter(log => log.rush_attempts > 0)
    .sort((a, b) => b.rush_yards - a.rush_yards)
    .slice(0, 5)
    .map(log =>
      toLeaderEntry(log, `${log.rush_yards} yds • ${log.rush_touchdowns} TD`, playersById, teamsById)
    )
    .filter(isLeaderEntry);

  const receiving = logs
    .filter(log => log.receiving_catches > 0)
    .sort((a, b) => b.receiving_yards - a.receiving_yards)
    .slice(0, 5)
    .map(log =>
      toLeaderEntry(
        log,
        `${log.receiving_yards} yds • ${log.receiving_touchdowns} TD`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  const defense = logs
    .filter(log => log.tackles > 0 || log.sacks > 0 || log.interceptions > 0)
    .sort(
      (a, b) =>
        (b.tackles + b.sacks * 2 + b.interceptions * 3) -
        (a.tackles + a.sacks * 2 + a.interceptions * 3)
    )
    .slice(0, 5)
    .map(log =>
      toLeaderEntry(
        log,
        `${log.tackles} tk • ${log.sacks} sk • ${log.interceptions} INT`,
        playersById,
        teamsById
      )
    )
    .filter(isLeaderEntry);

  return {
    teamA: buildTeamStats(game.teamA.id, game.scoreA, plays),
    teamB: buildTeamStats(game.teamB.id, game.scoreB, plays),
    leaders: {
      passing,
      rushing,
      receiving,
      defense,
    },
    boxScore: {
      teamA: buildTeamBoxScore(game.teamA.id, logs, playersByTeam, playersById, teamsById),
      teamB: buildTeamBoxScore(game.teamB.id, logs, playersByTeam, playersById, teamsById),
    },
  };
};
