import type { Team } from '../../../types/domain';
import type { GameRecord, PlayRecord, PlayerRecord } from '../../../types/db';

export type TeamPreviewMetricKey =
  | 'yards_per_game'
  | 'pass_yards_per_game'
  | 'pass_tds_per_game'
  | 'rush_yards_per_game'
  | 'turnovers_per_game'
  | 'points_per_game';

const average = (total: number, divisor: number) => {
  if (!divisor) return 0;
  return Math.round((total / divisor) * 10) / 10;
};

export const buildTeamStatsAndRanks = (
  teams: Team[],
  allGames: GameRecord[],
  allPlays: PlayRecord[],
  targetGame: GameRecord
) => {
  const pregameGames = allGames.filter(
    game =>
      game.year === targetGame.year &&
      game.winnerId !== null &&
      game.weekPlayed < targetGame.weekPlayed
  );
  const pregameGameIds = new Set(pregameGames.map(game => game.id));
  const pregamePlays = allPlays.filter(play => pregameGameIds.has(play.gameId));

  const gamesByTeamId = new Map<number, number>();
  const pointsByTeamId = new Map<number, number>();
  const rawStats = new Map<
    number,
    {
      passYards: number;
      passTds: number;
      rushYards: number;
      turnovers: number;
    }
  >();

  teams.forEach(team => {
    gamesByTeamId.set(team.id, 0);
    pointsByTeamId.set(team.id, 0);
    rawStats.set(team.id, {
      passYards: 0,
      passTds: 0,
      rushYards: 0,
      turnovers: 0,
    });
  });

  pregameGames.forEach(game => {
    gamesByTeamId.set(game.teamAId, (gamesByTeamId.get(game.teamAId) ?? 0) + 1);
    gamesByTeamId.set(game.teamBId, (gamesByTeamId.get(game.teamBId) ?? 0) + 1);
    pointsByTeamId.set(game.teamAId, (pointsByTeamId.get(game.teamAId) ?? 0) + (game.scoreA ?? 0));
    pointsByTeamId.set(game.teamBId, (pointsByTeamId.get(game.teamBId) ?? 0) + (game.scoreB ?? 0));
  });

  pregamePlays.forEach(play => {
    const teamStats = rawStats.get(play.offenseId);
    if (!teamStats) return;

    if (play.playType === 'pass') {
      teamStats.passYards += play.yardsGained;
      if (play.result === 'touchdown') {
        teamStats.passTds += 1;
      }
      if (play.result === 'interception') {
        teamStats.turnovers += 1;
      }
      if (play.result === 'fumble') {
        teamStats.turnovers += 1;
      }
      return;
    }

    if (play.playType === 'run') {
      teamStats.rushYards += play.yardsGained;
      if (play.result === 'fumble') {
        teamStats.turnovers += 1;
      }
      return;
    }

    if (play.result === 'fumble') {
      teamStats.turnovers += 1;
    }
  });

  const teamStatsById = new Map<number, Record<TeamPreviewMetricKey, number>>();

  teams.forEach(team => {
    const games = gamesByTeamId.get(team.id) ?? 0;
    const stats = rawStats.get(team.id)!;
    const teamStats = {
      yards_per_game: average(stats.passYards + stats.rushYards, games),
      pass_yards_per_game: average(stats.passYards, games),
      pass_tds_per_game: average(stats.passTds, games),
      rush_yards_per_game: average(stats.rushYards, games),
      turnovers_per_game: average(stats.turnovers, games),
      points_per_game: average(pointsByTeamId.get(team.id) ?? 0, games),
    };
    teamStatsById.set(team.id, teamStats);
  });

  const rankDirections: Record<TeamPreviewMetricKey, 'asc' | 'desc'> = {
    yards_per_game: 'desc',
    pass_yards_per_game: 'desc',
    pass_tds_per_game: 'desc',
    rush_yards_per_game: 'desc',
    turnovers_per_game: 'asc',
    points_per_game: 'desc',
  };

  const ranksByTeamId = new Map<number, Record<TeamPreviewMetricKey, number>>();
  const keys = Object.keys(rankDirections) as TeamPreviewMetricKey[];
  keys.forEach(key => {
    const sorted = teams
      .map(team => ({ id: team.id, value: teamStatsById.get(team.id)?.[key] ?? 0 }))
      .sort((a, b) => {
        if (rankDirections[key] === 'asc') return a.value - b.value;
        return b.value - a.value;
      });
    sorted.forEach((entry, index) => {
      const current = ranksByTeamId.get(entry.id) ?? ({} as Record<TeamPreviewMetricKey, number>);
      current[key] = index + 1;
      ranksByTeamId.set(entry.id, current);
    });
  });

  return { teamStatsById, ranksByTeamId };
};

export const buildTopStartersForTeam = (teamId: number, allPlayers: PlayerRecord[]) =>
  allPlayers
    .filter(player => player.active && player.starter && player.teamId === teamId)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map(player => ({
      id: player.id,
      first: player.first,
      last: player.last,
      pos: player.pos.toUpperCase(),
      rating: player.rating,
    }));

export const buildLastFiveGamesForTeam = (
  teamId: number,
  allGames: GameRecord[],
  teamsById: Map<number, Team>,
  targetGame: GameRecord
) =>
  allGames
    .filter(
      game =>
        game.year === targetGame.year &&
        game.winnerId !== null &&
        game.weekPlayed < targetGame.weekPlayed &&
        (game.teamAId === teamId || game.teamBId === teamId)
    )
    .sort((a, b) => (b.weekPlayed !== a.weekPlayed ? b.weekPlayed - a.weekPlayed : b.id - a.id))
    .slice(0, 5)
    .map(game => {
      const isTeamA = game.teamAId === teamId;
      const opponentId = isTeamA ? game.teamBId : game.teamAId;
      const opponent = teamsById.get(opponentId);
      const teamScore = isTeamA ? game.scoreA ?? 0 : game.scoreB ?? 0;
      const opponentScore = isTeamA ? game.scoreB ?? 0 : game.scoreA ?? 0;
      const location: 'vs' | '@' | 'N' = game.neutralSite
        ? 'N'
        : game.homeTeamId === teamId
          ? 'vs'
          : '@';
      const result: 'W' | 'L' = game.winnerId === teamId ? 'W' : 'L';

      return {
        id: game.id,
        week: game.weekPlayed,
        opponent: opponent?.name ?? 'Unknown',
        result,
        score: `${teamScore}-${opponentScore}`,
        location,
      };
    });
