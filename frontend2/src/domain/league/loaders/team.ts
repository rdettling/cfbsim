import type { Team } from '../../../types/domain';
import type { GameRecord, GameLogRecord, PlayerRecord } from '../../../types/db';
import type { RatingsData, HistoryData, YearData } from '../../../types/baseData';
import { getRatingsData, getYearData, getHistoryData, getYearsIndex } from '../../../db/baseData';
import { getAllGames, getAllPlayers, getAllGameLogs } from '../../../db/simRepo';
import { saveLeague } from '../../../db/leagueRepo';
import { loadLeagueOptional, loadLeagueOrThrow } from '../leagueStore';
import { ensureRosters, POSITION_ORDER } from '../../roster';
import { buildAwards } from '../awards';
import { buildScheduleGameForTeam } from '../utils/schedule';
import { average, percentage } from '../utils/statMath';


export const loadTeamRoster = async (teamName?: string) => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const roster = (await getAllPlayers()).filter(
    player => player.active && player.teamId === team.id
  );

  const positionSet = new Set(roster.map(player => player.pos));
  const orderedPositions = POSITION_ORDER.filter(pos => positionSet.has(pos));
  const extraPositions = Array.from(positionSet).filter(pos => !POSITION_ORDER.includes(pos));
  extraPositions.sort((a, b) => a.localeCompare(b));
  const positions = [...orderedPositions, ...extraPositions];

  return {
    info: league.info,
    team,
    roster,
    positions,
    conferences: league.conferences,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
  };
};

export const loadTeamHistory = async (teamName?: string) => {
  const league = await loadLeagueOrThrow();

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const startYear = league.info.startYear ?? league.info.currentYear;
  let historicalRows: Array<{
    year: number;
    prestige: number;
    rating: number | null;
    conference: string;
    wins: number;
    losses: number;
    rank: number;
    has_games: boolean;
  }> = [];

  try {
    const historyData = (await getHistoryData()) as HistoryData;
    const teamHistory = historyData.teams[team.name] ?? [];
    const confById = new Map(
      Object.entries(historyData.conf_index).map(([name, id]) => [id, name])
    );
    historicalRows = teamHistory
      .filter(entry => entry[0] < startYear)
      .sort((a, b) => b[0] - a[0])
      .map(entry => ({
        year: entry[0],
        prestige: (entry[5] ?? team.prestige) as number,
        rating: null,
        conference: confById.get(entry[1]) ?? 'Independent',
        wins: entry[3] ?? 0,
        losses: entry[4] ?? 0,
        rank: entry[2] ?? 0,
        has_games: false,
      }));
  } catch (error) {
    const yearsIndex = await getYearsIndex();
    const historicalYears = yearsIndex.years
      .map(entry => Number(entry))
      .filter(year => year < startYear)
      .sort((a, b) => b - a);

    const computed = await Promise.all(
      historicalYears.map(async year => {
        const ratingsData = (await getRatingsData(String(year))) as RatingsData;
        const yearData = (await getYearData(String(year))) as YearData;
        const teamEntry = ratingsData.teams.find(entry => entry.team === team.name);
        if (!teamEntry) return null;

        let prestige: number | null = null;
        const conferenceValues = Object.values(yearData.conferences ?? {}) as Array<{ teams: Record<string, number> }>;
        conferenceValues.some(confData => {
          if (team.name in confData.teams) {
            prestige = confData.teams[team.name];
            return true;
          }
          return false;
        });
        if (prestige == null && yearData.Independent && team.name in yearData.Independent) {
          prestige = yearData.Independent[team.name];
        }

        return {
          year,
          prestige: prestige ?? team.prestige,
          rating: null,
          conference: teamEntry.conference ?? 'Independent',
          wins: teamEntry.wins ?? 0,
          losses: teamEntry.losses ?? 0,
          rank: teamEntry.rank ?? 0,
          has_games: false,
        };
      })
    );
    historicalRows = computed.filter(Boolean) as typeof historicalRows;
    console.warn('History data preload missing, using ratings fallback.', error);
  }

  const years = [
    ...historicalRows,
    {
      year: league.info.currentYear,
      prestige: team.prestige,
      rating: team.rating ?? null,
      conference: team.conference ?? 'Independent',
      wins: team.totalWins,
      losses: team.totalLosses,
      rank: team.ranking ?? 0,
      has_games: true,
    },
  ];

  return {
    info: league.info,
    team,
    conferences: league.conferences,
    years,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
  };
};

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

const getPlayerInfoForYear = (player: PlayerRecord, currentYear: number, year: number) => {
  const yearDiff = currentYear - year;
  if (yearDiff === 0) return { classYear: player.year, rating: player.rating };
  if (yearDiff === 1) {
    if (player.year === 'sr') return { classYear: 'jr', rating: player.rating_jr };
    if (player.year === 'jr') return { classYear: 'so', rating: player.rating_so };
    if (player.year === 'so') return { classYear: 'fr', rating: player.rating_fr };
  }
  if (yearDiff === 2) {
    if (player.year === 'sr') return { classYear: 'so', rating: player.rating_so };
    if (player.year === 'jr') return { classYear: 'fr', rating: player.rating_fr };
  }
  if (yearDiff === 3) {
    return { classYear: 'fr', rating: player.rating_fr };
  }
  return { classYear: player.year, rating: player.rating };
};

const getPositionStats = (pos: string, stats: Record<string, any>) => {
  const baseStats = {
    class: stats.class,
    rating: stats.rating,
    games: stats.games,
  };

  if (pos === 'qb') {
    return {
      ...baseStats,
      pass_completions: stats.pass_completions,
      pass_attempts: stats.pass_attempts,
      completion_percentage: stats.completion_percentage,
      pass_yards: stats.pass_yards,
      pass_touchdowns: stats.pass_touchdowns,
      pass_interceptions: stats.pass_interceptions,
      passer_rating: stats.passer_rating,
      adjusted_pass_yards_per_attempt: stats.adjusted_pass_yards_per_attempt,
    };
  }

  if (pos === 'rb') {
    return {
      ...baseStats,
      rush_attempts: stats.rush_attempts,
      rush_yards: stats.rush_yards,
      yards_per_rush: stats.yards_per_rush,
      rush_touchdowns: stats.rush_touchdowns,
      receiving_catches: stats.receiving_catches,
      receiving_yards: stats.receiving_yards,
      yards_per_rec: stats.yards_per_rec,
      receiving_touchdowns: stats.receiving_touchdowns,
    };
  }

  if (pos === 'wr' || pos === 'te') {
    return {
      ...baseStats,
      receiving_catches: stats.receiving_catches,
      receiving_yards: stats.receiving_yards,
      yards_per_rec: stats.yards_per_rec,
      receiving_touchdowns: stats.receiving_touchdowns,
    };
  }

  if (pos === 'k') {
    return {
      ...baseStats,
      field_goals_made: stats.field_goals_made,
      field_goals_attempted: stats.field_goals_attempted,
      field_goal_percent: stats.field_goal_percent,
    };
  }

  return baseStats;
};

const getPositionGameLog = (pos: string, log: any) => {
  if (pos === 'qb') {
    return {
      ...log,
      pass_completions: log.pass_completions,
      pass_attempts: log.pass_attempts,
      completion_percent: percentage(log.pass_completions, log.pass_attempts),
      pass_yards: log.pass_yards,
      pass_touchdowns: log.pass_touchdowns,
      pass_interceptions: log.pass_interceptions,
      passer_rating: passerRating(
        log.pass_completions,
        log.pass_attempts,
        log.pass_yards,
        log.pass_touchdowns,
        log.pass_interceptions
      ),
    };
  }

  if (pos === 'rb') {
    return {
      ...log,
      rush_attempts: log.rush_attempts,
      rush_yards: log.rush_yards,
      rush_touchdowns: log.rush_touchdowns,
      receiving_catches: log.receiving_catches,
      receiving_yards: log.receiving_yards,
      yards_per_rec: average(log.receiving_yards, log.receiving_catches),
      receiving_touchdowns: log.receiving_touchdowns,
    };
  }

  if (pos === 'wr' || pos === 'te') {
    return {
      ...log,
      receiving_catches: log.receiving_catches,
      receiving_yards: log.receiving_yards,
      yards_per_rec: average(log.receiving_yards, log.receiving_catches),
      receiving_touchdowns: log.receiving_touchdowns,
    };
  }

  if (pos === 'k') {
    return {
      ...log,
      field_goals_made: log.field_goals_made,
      field_goals_attempted: log.field_goals_attempted,
      field_goal_percent: percentage(log.field_goals_made, log.field_goals_attempted),
    };
  }

  return log;
};

const calculateYearlyStats = (
  player: PlayerRecord,
  logs: Array<{ log: any }>,
  currentYear: number,
  year: number
) => {
  const yearStats = {
    games: logs.length,
    pass_completions: 0,
    pass_attempts: 0,
    pass_yards: 0,
    pass_touchdowns: 0,
    pass_interceptions: 0,
    rush_attempts: 0,
    rush_yards: 0,
    rush_touchdowns: 0,
    receiving_catches: 0,
    receiving_yards: 0,
    receiving_touchdowns: 0,
    field_goals_made: 0,
    field_goals_attempted: 0,
  };

  logs.forEach(entry => {
    Object.keys(yearStats).forEach(key => {
      if (key === 'games') return;
      yearStats[key as keyof typeof yearStats] += Number(entry.log[key] ?? 0);
    });
  });

  return {
    ...yearStats,
    class: getPlayerInfoForYear(player, currentYear, year).classYear,
    rating: getPlayerInfoForYear(player, currentYear, year).rating,
    completion_percentage: percentage(yearStats.pass_completions, yearStats.pass_attempts),
    pass_ypa: average(yearStats.pass_yards, yearStats.pass_attempts),
    rush_ypa: average(yearStats.rush_yards, yearStats.rush_attempts),
    receiving_ypr: average(yearStats.receiving_yards, yearStats.receiving_catches),
    passer_rating: passerRating(
      yearStats.pass_completions,
      yearStats.pass_attempts,
      yearStats.pass_yards,
      yearStats.pass_touchdowns,
      yearStats.pass_interceptions
    ),
    adjusted_pass_yards_per_attempt: adjustedPassYardsPerAttempt(
      yearStats.pass_yards,
      yearStats.pass_touchdowns,
      yearStats.pass_interceptions,
      yearStats.pass_attempts
    ),
  };
};

const getPlayerYears = (
  player: PlayerRecord,
  currentYear: number,
  logs: GameLogRecord[],
  gamesById: Map<number, GameRecord>
) => {
  const yearsFromLogs = logs
    .map(log => gamesById.get(log.gameId))
    .filter(Boolean)
    .map(game => game?.year)
    .filter(Boolean) as number[];

  const yearMapping: Record<PlayerRecord['year'], number[]> = {
    fr: [currentYear],
    so: [currentYear, currentYear - 1],
    jr: [currentYear, currentYear - 1, currentYear - 2],
    sr: [currentYear, currentYear - 1, currentYear - 2, currentYear - 3],
  };
  return Array.from(new Set([...yearsFromLogs, ...(yearMapping[player.year] ?? [currentYear])]))
    .filter(year => year <= currentYear)
    .sort((a, b) => b - a);
};

export const loadPlayer = async (playerId: string) => {
  const league = await loadLeagueOrThrow();
  await ensureRosters(league);
  await saveLeague(league);

  const [players, gameLogs, games] = await Promise.all([
    getAllPlayers(),
    getAllGameLogs(),
    getAllGames(),
  ]);

  const player = players.find(entry => entry.id === Number(playerId));
  if (!player) {
    throw new Error('Player not found.');
  }

  const team = league.teams.find(entry => entry.id === player.teamId);
  if (!team) {
    throw new Error('Team not found for player.');
  }

  const gamesById = new Map(games.map(game => [game.id, game]));
  const teamsById = new Map(league.teams.map(entry => [entry.id, entry]));

  const playerLogs = gameLogs.filter(log => log.playerId === player.id);
  const years = getPlayerYears(player, league.info.currentYear, playerLogs, gamesById);

  const career_stats: Record<number, any> = {};
  const game_logs: Record<number, any[]> = {};

  years.forEach(year => {
    const yearLogs = playerLogs
      .map(log => ({ log, game: gamesById.get(log.gameId) }))
      .filter(entry => entry.game && entry.game.year === year);

    const logsWithGames = yearLogs
      .map(entry => {
        const scheduleGame = buildScheduleGameForTeam(team, entry.game!, teamsById);
        if (!scheduleGame) return null;
        return getPositionGameLog(player.pos, { ...entry.log, game: scheduleGame });
      })
      .filter(Boolean) as any[];

    logsWithGames.sort((a, b) => (a.game?.weekPlayed ?? 0) - (b.game?.weekPlayed ?? 0));

    const yearStats = calculateYearlyStats(player, yearLogs as any, league.info.currentYear, year);
    career_stats[year] = getPositionStats(player.pos, yearStats);
    game_logs[year] = logsWithGames;
  });

  const awards =
    league.info.stage === 'summary'
      ? buildAwards(league, players, gameLogs.filter(log => {
          const game = gamesById.get(log.gameId);
          return game?.year === league.info.currentYear && game.winnerId !== null;
        }))
          .final.filter(entry => entry.first_place?.id === player.id)
          .map(entry => ({ slug: entry.category_slug, name: entry.category_name }))
      : [];

  return {
    info: league.info,
    player: {
      ...player,
      team: team.name,
    },
    team,
    conferences: league.conferences,
    career_stats,
    game_logs,
    awards,
  };
};

export const getTeamInfo = async (teamName: string): Promise<Team | null> => {
  const league = await loadLeagueOptional();
  if (!league) return null;
  return league.teams.find(team => team.name === teamName) ?? null;
};
