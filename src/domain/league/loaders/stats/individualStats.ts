import { loadLeague, saveLeague } from '../../../../db/leagueRepo';
import { getAllGameLogs, getAllGames, getAllPlayers } from '../../../../db/simRepo';
import { ensureRosters } from '../../../roster';
import type { LeagueState } from '../../../../types/league';
import type {
  IndividualStatsPageResult,
  PassingStats,
  ReceivingStats,
  RushingStats,
} from '../../../../types/stats';
import { average, percentage } from '../../utils/statMath';

const MIN_YARDS = 100;

const passerRating = (
  completions: number,
  attempts: number,
  yards: number,
  touchdowns: number,
  interceptions: number
) => {
  if (!attempts) return 0;
  const a = Math.max(0, Math.min(((completions / attempts) - 0.3) * 5, 2.375));
  const b = Math.max(0, Math.min(((yards / attempts) - 3) * 0.25, 2.375));
  const c = Math.max(0, Math.min((touchdowns / attempts) * 20, 2.375));
  const d = Math.max(0, Math.min(2.375 - ((interceptions / attempts) * 25), 2.375));
  return Math.round((((a + b + c + d) / 6) * 100) * 10) / 10;
};

const adjustedPassYardsPerAttempt = (
  yards: number,
  touchdowns: number,
  interceptions: number,
  attempts: number
) =>
  attempts
    ? Math.round(((yards + 20 * touchdowns - 45 * interceptions) / attempts) * 10) / 10
    : 0;

export const loadIndividualStats = async (): Promise<IndividualStatsPageResult> => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  await ensureRosters(league);
  await saveLeague(league);

  const [players, gameLogs, games] = await Promise.all([
    getAllPlayers(),
    getAllGameLogs(),
    getAllGames(),
  ]);
  const playedGameIds = new Set(
    games
      .filter(game => game.year === league.info.currentYear && game.winnerId !== null)
      .map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const passingTotals = new Map<number, { att: number; cmp: number; yards: number; td: number; inter: number }>();
  const rushingTotals = new Map<number, { att: number; yards: number; td: number; fumbles: number }>();
  const receivingTotals = new Map<number, { rec: number; yards: number; td: number }>();

  yearLogs.forEach(log => {
    const pass = passingTotals.get(log.playerId) ?? { att: 0, cmp: 0, yards: 0, td: 0, inter: 0 };
    pass.att += log.pass_attempts;
    pass.cmp += log.pass_completions;
    pass.yards += log.pass_yards;
    pass.td += log.pass_touchdowns;
    pass.inter += log.pass_interceptions;
    passingTotals.set(log.playerId, pass);

    const rush = rushingTotals.get(log.playerId) ?? { att: 0, yards: 0, td: 0, fumbles: 0 };
    rush.att += log.rush_attempts;
    rush.yards += log.rush_yards;
    rush.td += log.rush_touchdowns;
    rush.fumbles += log.fumbles;
    rushingTotals.set(log.playerId, rush);

    const receiving = receivingTotals.get(log.playerId) ?? { rec: 0, yards: 0, td: 0 };
    receiving.rec += log.receiving_catches;
    receiving.yards += log.receiving_yards;
    receiving.td += log.receiving_touchdowns;
    receivingTotals.set(log.playerId, receiving);
  });

  const passing: IndividualStatsPageResult['stats']['passing'] = {};
  const rushing: IndividualStatsPageResult['stats']['rushing'] = {};
  const receiving: IndividualStatsPageResult['stats']['receiving'] = {};

  players.filter(player => player.starter && player.pos === 'qb').forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const row = passingTotals.get(player.id) ?? { att: 0, cmp: 0, yards: 0, td: 0, inter: 0 };
    const stats: PassingStats = {
      att: row.att,
      cmp: row.cmp,
      yards: row.yards,
      td: row.td,
      int: row.inter,
      pct: percentage(row.cmp, row.att),
      passer_rating: passerRating(row.cmp, row.att, row.yards, row.td, row.inter),
      adjusted_pass_yards_per_attempt: adjustedPassYardsPerAttempt(row.yards, row.td, row.inter, row.att),
      yards_per_game: average(row.yards, team.gamesPlayed),
    };
    passing[String(player.id)] = {
      id: player.id, first: player.first, last: player.last, pos: player.pos,
      team: team.name, gamesPlayed: team.gamesPlayed, stats,
    };
  });

  players.filter(player => player.starter && (player.pos === 'qb' || player.pos === 'rb')).forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const row = rushingTotals.get(player.id) ?? { att: 0, yards: 0, td: 0, fumbles: 0 };
    if (row.yards < MIN_YARDS) return;
    const stats: RushingStats = {
      att: row.att, yards: row.yards, td: row.td, fumbles: row.fumbles,
      yards_per_rush: average(row.yards, row.att),
      yards_per_game: average(row.yards, team.gamesPlayed),
    };
    rushing[String(player.id)] = {
      id: player.id, first: player.first, last: player.last, pos: player.pos,
      team: team.name, gamesPlayed: team.gamesPlayed, stats,
    };
  });

  players.filter(player => player.starter && ['rb', 'wr', 'te'].includes(player.pos)).forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const row = receivingTotals.get(player.id) ?? { rec: 0, yards: 0, td: 0 };
    if (row.yards < MIN_YARDS) return;
    const stats: ReceivingStats = {
      rec: row.rec, yards: row.yards, td: row.td,
      yards_per_rec: average(row.yards, row.rec),
      yards_per_game: average(row.yards, team.gamesPlayed),
    };
    receiving[String(player.id)] = {
      id: player.id, first: player.first, last: player.last, pos: player.pos,
      team: team.name, gamesPlayed: team.gamesPlayed, stats,
    };
  });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    stats: { passing, rushing, receiving },
  };
};
