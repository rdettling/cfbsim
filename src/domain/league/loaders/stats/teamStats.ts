import { loadLeague, saveLeague } from '../../../../db/leagueRepo';
import { getAllGames, getAllPlays } from '../../../../db/simRepo';
import { ensureRosters } from '../../../roster';
import type { Team } from '../../../../types/domain';
import type { LeagueState } from '../../../../types/league';
import type { TeamStats, TeamStatsPageResult } from '../../../../types/stats';
import { average, percentage } from '../../utils/statMath';

type StatsGame = {
  teamAId: number;
  teamBId: number;
  scoreA: number | null;
  scoreB: number | null;
};

type StatsPlay = {
  playType: string;
  yardsGained: number;
  yardsLeft: number;
  result: string;
};

const accumulateTeamStats = (
  team: Team,
  games: StatsGame[],
  plays: StatsPlay[]
): TeamStats => {
  let passYards = 0;
  let rushYards = 0;
  let comp = 0;
  let att = 0;
  let rushAtt = 0;
  let passTd = 0;
  let rushTd = 0;
  let fumbles = 0;
  let interceptions = 0;
  let points = 0;
  let playCount = 0;
  let firstDownsPass = 0;
  let firstDownsRush = 0;
  const gamesPlayed = team.gamesPlayed;

  games.forEach(game => {
    points += game.teamAId === team.id ? game.scoreA ?? 0 : game.scoreB ?? 0;
  });

  plays.forEach(play => {
    if (play.playType === 'pass') {
      playCount += 1;
      passYards += play.yardsGained;
      if (play.result === 'pass') {
        comp += 1;
        att += 1;
      } else if (play.result === 'touchdown') {
        comp += 1;
        att += 1;
        passTd += 1;
      } else if (play.result === 'incomplete pass') {
        att += 1;
      } else if (play.result === 'interception') {
        att += 1;
        interceptions += 1;
      }
      if (play.yardsGained >= play.yardsLeft) firstDownsPass += 1;
    } else if (play.playType === 'run') {
      playCount += 1;
      rushYards += play.yardsGained;
      if (play.result === 'run') {
        rushAtt += 1;
      } else if (play.result === 'touchdown') {
        rushAtt += 1;
        rushTd += 1;
      } else if (play.result === 'fumble') {
        fumbles += 1;
      }
      if (play.yardsGained >= play.yardsLeft) firstDownsRush += 1;
    }
  });

  const totalYards = passYards + rushYards;
  const firstDownsTotal = firstDownsPass + firstDownsRush;
  const turnovers = fumbles + interceptions;

  return {
    games: gamesPlayed,
    ppg: average(points, gamesPlayed),
    pass_cpg: average(comp, gamesPlayed),
    pass_apg: average(att, gamesPlayed),
    comp_percent: percentage(comp, att),
    pass_ypg: average(passYards, gamesPlayed),
    pass_tdpg: average(passTd, gamesPlayed),
    rush_apg: average(rushAtt, gamesPlayed),
    rush_ypg: average(rushYards, gamesPlayed),
    rush_ypc: average(rushYards, rushAtt),
    rush_tdpg: average(rushTd, gamesPlayed),
    playspg: average(playCount, gamesPlayed),
    yardspg: average(totalYards, gamesPlayed),
    ypp: average(totalYards, playCount),
    first_downs_pass: average(firstDownsPass, gamesPlayed),
    first_downs_rush: average(firstDownsRush, gamesPlayed),
    first_downs_total: average(firstDownsTotal, gamesPlayed),
    fumbles: average(fumbles, gamesPlayed),
    interceptions: average(interceptions, gamesPlayed),
    turnovers: average(turnovers, gamesPlayed),
  };
};

const calculateAverages = (stats: Record<string, TeamStats>): TeamStats => {
  const entries = Object.values(stats);
  const result = {} as TeamStats;
  (Object.keys(entries[0] ?? {}) as Array<keyof TeamStats>).forEach(key => {
    result[key] = entries.length
      ? Math.round(
          (entries.reduce((sum, teamStats) => sum + teamStats[key], 0) /
            entries.length) *
            10
        ) / 10
      : 0;
  });
  return result;
};

export const loadTeamStats = async (): Promise<TeamStatsPageResult> => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  await ensureRosters(league);
  await saveLeague(league);

  const [games, plays] = await Promise.all([getAllGames(), getAllPlays()]);
  const playedGames = games.filter(
    game => game.year === league.info.currentYear && game.winnerId !== null
  );
  const playedGameIds = new Set(playedGames.map(game => game.id));
  const yearPlays = plays.filter(play => playedGameIds.has(play.gameId));
  const offense: Record<string, TeamStats> = {};
  const defense: Record<string, TeamStats> = {};

  league.teams.forEach(team => {
    const teamGames = playedGames.filter(
      game => game.teamAId === team.id || game.teamBId === team.id
    );
    offense[team.name] = accumulateTeamStats(
      team,
      teamGames,
      yearPlays.filter(play => play.offenseId === team.id)
    );
    defense[team.name] = accumulateTeamStats(
      team,
      teamGames,
      yearPlays.filter(play => play.defenseId === team.id)
    );
  });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    offense,
    defense,
    offense_averages: calculateAverages(offense),
    defense_averages: calculateAverages(defense),
  };
};
