import type { Team } from '../../types/domain';
import { loadLeague, saveLeague } from '../../db/leagueRepo';
import {
  getAllGames,
  getAllPlays,
  getAllPlayers,
  getAllGameLogs,
} from '../../db/simRepo';
import { ensureRosters } from '../roster';
import type { LeagueState } from '../../types/league';
import { average, percentage } from './utils/statMath';

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
  const rating = ((a + b + c + d) / 6) * 100;
  return Math.round(rating * 10) / 10;
};

const adjustedPassYardsPerAttempt = (
  passingYards: number,
  touchdownPasses: number,
  interceptions: number,
  passAttempts: number
) => {
  if (!passAttempts) return 0;
  const aya = (passingYards + 20 * touchdownPasses - 45 * interceptions) / passAttempts;
  return Math.round(aya * 10) / 10;
};

const accumulateTeamStats = (
  team: Team,
  games: Array<{
    teamAId: number;
    teamBId: number;
    scoreA: number | null;
    scoreB: number | null;
  }>,
  plays: Array<{
    playType: string;
    yardsGained: number;
    yardsLeft: number;
    result: string;
  }>
) => {
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
    if (game.teamAId === team.id) {
      points += game.scoreA ?? 0;
    } else {
      points += game.scoreB ?? 0;
    }
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

      if (play.yardsGained >= play.yardsLeft) {
        firstDownsPass += 1;
      }
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

      if (play.yardsGained >= play.yardsLeft) {
        firstDownsRush += 1;
      }
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

export const loadTeamStats = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  await ensureRosters(league);
  await saveLeague(league);

  const games = await getAllGames();
  const plays = await getAllPlays();
  const currentYear = league.info.currentYear;

  const playedGames = games.filter(
    game => game.year === currentYear && game.winnerId !== null
  );
  const playedGameIds = new Set(playedGames.map(game => game.id));
  const yearPlays = plays.filter(play => playedGameIds.has(play.gameId));

  const offense: Record<string, any> = {};
  const defense: Record<string, any> = {};

  league.teams.forEach(team => {
    const teamGames = playedGames.filter(
      game => game.teamAId === team.id || game.teamBId === team.id
    );
    const offensePlays = yearPlays.filter(play => play.offenseId === team.id);
    const defensePlays = yearPlays.filter(play => play.defenseId === team.id);

    offense[team.name] = accumulateTeamStats(team, teamGames, offensePlays);
    defense[team.name] = accumulateTeamStats(team, teamGames, defensePlays);
  });

  const calculateAverages = (statsDict: Record<string, any>) => {
    const entries = Object.values(statsDict);
    if (!entries.length) return {};
    const keys = Object.keys(entries[0] || {});
    const averages: Record<string, number> = {};
    keys.forEach(key => {
      const values = entries.map(stats => stats[key]).filter(value => value !== null);
      if (values.length) {
        averages[key] = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
      } else {
        averages[key] = 0;
      }
    });
    return averages;
  };

  const offense_averages = calculateAverages(offense);
  const defense_averages = calculateAverages(defense);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    offense,
    defense,
    offense_averages,
    defense_averages,
  };
};

export const loadIndividualStats = async () => {
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

  const currentYear = league.info.currentYear;
  const playedGameIds = new Set(
    games.filter(game => game.year === currentYear && game.winnerId !== null).map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const passingTotals = new Map<number, { att: number; cmp: number; yards: number; td: number; inter: number }>();
  const rushingTotals = new Map<number, { att: number; yards: number; td: number; fumbles: number }>();
  const receivingTotals = new Map<number, { rec: number; yards: number; td: number }>();

  yearLogs.forEach(log => {
    const passRow = passingTotals.get(log.playerId) ?? { att: 0, cmp: 0, yards: 0, td: 0, inter: 0 };
    passRow.att += log.pass_attempts;
    passRow.cmp += log.pass_completions;
    passRow.yards += log.pass_yards;
    passRow.td += log.pass_touchdowns;
    passRow.inter += log.pass_interceptions;
    passingTotals.set(log.playerId, passRow);

    const rushRow = rushingTotals.get(log.playerId) ?? { att: 0, yards: 0, td: 0, fumbles: 0 };
    rushRow.att += log.rush_attempts;
    rushRow.yards += log.rush_yards;
    rushRow.td += log.rush_touchdowns;
    rushRow.fumbles += log.fumbles;
    rushingTotals.set(log.playerId, rushRow);

    const recvRow = receivingTotals.get(log.playerId) ?? { rec: 0, yards: 0, td: 0 };
    recvRow.rec += log.receiving_catches;
    recvRow.yards += log.receiving_yards;
    recvRow.td += log.receiving_touchdowns;
    receivingTotals.set(log.playerId, recvRow);
  });

  const passing: Record<string, any> = {};
  const rushing: Record<string, any> = {};
  const receiving: Record<string, any> = {};

  players
    .filter(player => player.starter && player.pos === 'qb')
    .forEach(player => {
      const team = teamsById.get(player.teamId);
      if (!team) return;
      const row = passingTotals.get(player.id) ?? { att: 0, cmp: 0, yards: 0, td: 0, inter: 0 };
      passing[player.id.toString()] = {
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        team: team.name,
        gamesPlayed: team.gamesPlayed,
        stats: {
          att: row.att,
          cmp: row.cmp,
          yards: row.yards,
          td: row.td,
          int: row.inter,
          pct: percentage(row.cmp, row.att),
          passer_rating: passerRating(row.cmp, row.att, row.yards, row.td, row.inter),
          adjusted_pass_yards_per_attempt: adjustedPassYardsPerAttempt(
            row.yards,
            row.td,
            row.inter,
            row.att
          ),
          yards_per_game: average(row.yards, team.gamesPlayed),
        },
      };
    });

  players
    .filter(player => player.starter && (player.pos === 'qb' || player.pos === 'rb'))
    .forEach(player => {
      const team = teamsById.get(player.teamId);
      if (!team) return;
      const row = rushingTotals.get(player.id) ?? { att: 0, yards: 0, td: 0, fumbles: 0 };
      if (row.yards < MIN_YARDS) return;
      rushing[player.id.toString()] = {
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        team: team.name,
        gamesPlayed: team.gamesPlayed,
        stats: {
          att: row.att,
          yards: row.yards,
          td: row.td,
          fumbles: row.fumbles,
          yards_per_rush: average(row.yards, row.att),
          yards_per_game: average(row.yards, team.gamesPlayed),
        },
      };
    });

  players
    .filter(player => player.starter && ['rb', 'wr', 'te'].includes(player.pos))
    .forEach(player => {
      const team = teamsById.get(player.teamId);
      if (!team) return;
      const row = receivingTotals.get(player.id) ?? { rec: 0, yards: 0, td: 0 };
      if (row.yards < MIN_YARDS) return;
      receiving[player.id.toString()] = {
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        team: team.name,
        gamesPlayed: team.gamesPlayed,
        stats: {
          rec: row.rec,
          yards: row.yards,
          td: row.td,
          yards_per_rec: average(row.yards, row.rec),
          yards_per_game: average(row.yards, team.gamesPlayed),
        },
      };
    });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    stats: {
      passing,
      rushing,
      receiving,
    },
  };
};
