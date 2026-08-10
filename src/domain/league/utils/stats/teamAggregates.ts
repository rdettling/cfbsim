import type { GameRecord, PlayRecord } from '../../../../types/db';
import type { Team } from '../../../../types/domain';
import type { SeasonTeamSnapshot } from '../../../../types/memory';
import type {
  SortDirection,
  TeamAggregateMode,
  TeamAggregateStatKey,
  TeamAggregateStats,
  TeamAggregateTotals,
} from '../../../../types/stats';
import { average, percentage } from '../../utils/statMath';

const TURNOVER_KEYS: TeamAggregateStatKey[] = [
  'fumbles',
  'interceptions',
  'turnovers',
];

export const getTeamAggregateDirection = (
  key: TeamAggregateStatKey,
  mode: TeamAggregateMode,
): SortDirection => {
  if (mode === 'defense') {
    return TURNOVER_KEYS.includes(key) ? 'desc' : 'asc';
  }
  return TURNOVER_KEYS.includes(key) ? 'asc' : 'desc';
};

export const accumulateTeamAggregateTotals = (
  team: Team,
  games: GameRecord[],
  plays: PlayRecord[],
  mode: TeamAggregateMode = 'offense',
): TeamAggregateTotals => {
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
    const teamIsA = game.teamAId === team.id;
    points += mode === 'offense'
      ? (teamIsA ? game.scoreA ?? 0 : game.scoreB ?? 0)
      : (teamIsA ? game.scoreB ?? 0 : game.scoreA ?? 0);
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

  return {
    games: gamesPlayed,
    points,
    pass_completions: comp,
    pass_attempts: att,
    pass_yards: passYards,
    pass_touchdowns: passTd,
    rush_attempts: rushAtt,
    rush_yards: rushYards,
    rush_touchdowns: rushTd,
    plays: playCount,
    first_downs_pass: firstDownsPass,
    first_downs_rush: firstDownsRush,
    fumbles,
    interceptions,
  };
};

export const projectTeamAggregateStats = (
  totals: TeamAggregateTotals,
): TeamAggregateStats => {
  const totalYards = totals.pass_yards + totals.rush_yards;
  const firstDownsTotal =
    totals.first_downs_pass + totals.first_downs_rush;
  const turnovers = totals.fumbles + totals.interceptions;

  return {
    games: totals.games,
    ppg: average(totals.points, totals.games),
    pass_cpg: average(totals.pass_completions, totals.games),
    pass_apg: average(totals.pass_attempts, totals.games),
    comp_percent: percentage(totals.pass_completions, totals.pass_attempts),
    pass_ypg: average(totals.pass_yards, totals.games),
    pass_tdpg: average(totals.pass_touchdowns, totals.games),
    rush_apg: average(totals.rush_attempts, totals.games),
    rush_ypg: average(totals.rush_yards, totals.games),
    rush_ypc: average(totals.rush_yards, totals.rush_attempts),
    rush_tdpg: average(totals.rush_touchdowns, totals.games),
    playspg: average(totals.plays, totals.games),
    yardspg: average(totalYards, totals.games),
    ypp: average(totalYards, totals.plays),
    first_downs_pass: average(totals.first_downs_pass, totals.games),
    first_downs_rush: average(totals.first_downs_rush, totals.games),
    first_downs_total: average(firstDownsTotal, totals.games),
    fumbles: average(totals.fumbles, totals.games),
    interceptions: average(totals.interceptions, totals.games),
    turnovers: average(turnovers, totals.games),
  };
};

export const accumulateTeamAggregateStats = (
  team: Team,
  games: GameRecord[],
  plays: PlayRecord[],
  mode: TeamAggregateMode = 'offense',
): TeamAggregateStats =>
  projectTeamAggregateStats(
    accumulateTeamAggregateTotals(team, games, plays, mode),
  );

export const calculateTeamAggregateAverages = (
  stats: Record<string, TeamAggregateStats>,
): TeamAggregateStats => {
  const entries = Object.values(stats);
  const result = {} as TeamAggregateStats;
  (Object.keys(entries[0] ?? {}) as TeamAggregateStatKey[]).forEach(key => {
    result[key] = entries.length
      ? Math.round(
          (entries.reduce((sum, teamStats) => sum + teamStats[key], 0) /
            entries.length) *
            10,
        ) / 10
      : 0;
  });
  return result;
};

export const buildTeamAggregateTotalTables = (
  teams: Team[],
  games: GameRecord[],
  plays: PlayRecord[],
  currentYear: number,
) => {
  const playedGames = games.filter(
    game => game.year === currentYear && game.winnerId !== null,
  );
  const playedGameIds = new Set(playedGames.map(game => game.id));
  const yearPlays = plays.filter(play => playedGameIds.has(play.gameId));
  const offense: Record<string, TeamAggregateTotals> = {};
  const defense: Record<string, TeamAggregateTotals> = {};

  teams.forEach(team => {
    const teamGames = playedGames.filter(
      game => game.teamAId === team.id || game.teamBId === team.id,
    );
    offense[team.name] = accumulateTeamAggregateTotals(
      team,
      teamGames,
      yearPlays.filter(play => play.offenseId === team.id),
      'offense',
    );
    defense[team.name] = accumulateTeamAggregateTotals(
      team,
      teamGames,
      yearPlays.filter(play => play.defenseId === team.id),
      'defense',
    );
  });

  return { offense, defense };
};

export const buildTeamAggregateTables = (
  teams: Team[],
  games: GameRecord[],
  plays: PlayRecord[],
  currentYear: number,
) => {
  const totals = buildTeamAggregateTotalTables(teams, games, plays, currentYear);
  const offense: Record<string, TeamAggregateStats> = {};
  const defense: Record<string, TeamAggregateStats> = {};
  Object.keys(totals.offense).forEach(teamName => {
    offense[teamName] = projectTeamAggregateStats(totals.offense[teamName]);
    defense[teamName] = projectTeamAggregateStats(totals.defense[teamName]);
  });
  return { offense, defense };
};

export const projectArchivedTeamAggregateTables = (
  teams: Team[],
  snapshots: SeasonTeamSnapshot[],
) => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const offense: Record<string, TeamAggregateStats> = {};
  const defense: Record<string, TeamAggregateStats> = {};
  snapshots.forEach(snapshot => {
    const team = teamsById.get(snapshot.teamId);
    if (!team) throw new Error(`Season snapshot references missing team ${snapshot.teamId}.`);
    offense[team.name] = projectTeamAggregateStats(snapshot.offense);
    defense[team.name] = projectTeamAggregateStats(snapshot.defense);
  });
  return { offense, defense };
};

export const buildTeamAggregateRanks = (
  stats: Record<string, TeamAggregateStats>,
  mode: TeamAggregateMode,
) => {
  const ranks = new Map<string, Record<TeamAggregateStatKey, number>>();
  const keys = Object.keys(Object.values(stats)[0] ?? {}) as TeamAggregateStatKey[];
  Object.keys(stats).forEach(teamName => {
    ranks.set(teamName, {} as Record<TeamAggregateStatKey, number>);
  });

  keys.forEach(key => {
    const direction = getTeamAggregateDirection(key, mode);
    Object.entries(stats)
      .sort(([, left], [, right]) => {
        const difference = left[key] - right[key];
        return direction === 'asc' ? difference : -difference;
      })
      .forEach(([teamName], index) => {
        ranks.get(teamName)![key] = index + 1;
      });
  });

  return ranks;
};
