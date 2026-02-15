import type { ScheduleGame, Team } from '../../types/domain';
import { getYearsIndex, getRatingsData, getYearData, getHistoryData } from '../../db/baseData';
import { saveLeague } from '../../db/leagueRepo';
import {
  getAllGames,
  getAllPlayers,
  getGameById,
  getDrivesByGame,
  getPlaysByGame,
  getAllGameLogs,
} from '../../db/simRepo';
import { ensureRosters, POSITION_ORDER } from '../roster';
import { buildDriveResponse } from '../sim';
import { DEFAULT_SETTINGS, ensureSettings } from '../../types/league';
import { loadLeagueOrThrow, loadLeagueOptional } from './leagueStore';
import type { GameRecord, GameLogRecord, PlayerRecord } from '../../types/db';
import type { RatingsData, HistoryData, YearData } from '../../types/baseData';
import { buildAwards } from './awards';

// loadLeagueOrThrow / loadLeagueOptional live in leagueStore.ts

export const loadRatingsStats = async () => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const players = (await getAllPlayers()).filter(player => player.active);
  const teams = league.teams;

  const totalCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatings: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsFr: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsSo: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsJr: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRatingsSr: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  players.forEach(player => {
    const star = Math.min(5, Math.max(1, player.stars || 1));
    totalCounts[star] += 1;
    totalRatings[star] += player.rating;
    totalRatingsFr[star] += player.rating_fr;
    totalRatingsSo[star] += player.rating_so;
    totalRatingsJr[star] += player.rating_jr;
    totalRatingsSr[star] += player.rating_sr;
  });

  const avg = (sum: number, count: number) => (count ? Math.round(sum / count) : 0);

  const total_star_counts = {
    counts: totalCounts,
    avg_ratings: {
      1: avg(totalRatings[1], totalCounts[1]),
      2: avg(totalRatings[2], totalCounts[2]),
      3: avg(totalRatings[3], totalCounts[3]),
      4: avg(totalRatings[4], totalCounts[4]),
      5: avg(totalRatings[5], totalCounts[5]),
    },
    avg_ratings_fr: {
      1: avg(totalRatingsFr[1], totalCounts[1]),
      2: avg(totalRatingsFr[2], totalCounts[2]),
      3: avg(totalRatingsFr[3], totalCounts[3]),
      4: avg(totalRatingsFr[4], totalCounts[4]),
      5: avg(totalRatingsFr[5], totalCounts[5]),
    },
    avg_ratings_so: {
      1: avg(totalRatingsSo[1], totalCounts[1]),
      2: avg(totalRatingsSo[2], totalCounts[2]),
      3: avg(totalRatingsSo[3], totalCounts[3]),
      4: avg(totalRatingsSo[4], totalCounts[4]),
      5: avg(totalRatingsSo[5], totalCounts[5]),
    },
    avg_ratings_jr: {
      1: avg(totalRatingsJr[1], totalCounts[1]),
      2: avg(totalRatingsJr[2], totalCounts[2]),
      3: avg(totalRatingsJr[3], totalCounts[3]),
      4: avg(totalRatingsJr[4], totalCounts[4]),
      5: avg(totalRatingsJr[5], totalCounts[5]),
    },
    avg_ratings_sr: {
      1: avg(totalRatingsSr[1], totalCounts[1]),
      2: avg(totalRatingsSr[2], totalCounts[2]),
      3: avg(totalRatingsSr[3], totalCounts[3]),
      4: avg(totalRatingsSr[4], totalCounts[4]),
      5: avg(totalRatingsSr[5], totalCounts[5]),
    },
  };

  const team_counts_by_prestige = Array.from(
    new Set(teams.map(team => team.prestige))
  )
    .sort((a, b) => a - b)
    .map(prestige => ({
      prestige,
      team_count: teams.filter(team => team.prestige === prestige).length,
    }));

  const prestige_stars_table = team_counts_by_prestige.map(entry => {
    const prestigeTeams = teams.filter(team => team.prestige === entry.prestige);
    const teamIds = new Set(prestigeTeams.map(team => team.id));
    const prestigePlayers = players.filter(player => teamIds.has(player.teamId));
    const totalPlayers = prestigePlayers.length || 1;
    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let starSum = 0;
    prestigePlayers.forEach(player => {
      const star = Math.min(5, Math.max(1, player.stars || 1)) as 1 | 2 | 3 | 4 | 5;
      starCounts[star] += 1;
      starSum += star;
    });

    const avg_rating = prestigeTeams.length
      ? Math.round(
          prestigeTeams.reduce((sum, team) => sum + team.rating, 0) / prestigeTeams.length
        )
      : 0;

    return {
      prestige: entry.prestige,
      avg_rating,
      avg_stars: totalPlayers ? Math.round((starSum / totalPlayers) * 10) / 10 : 0,
      star_percentages: {
        5: Math.round((starCounts[5] / totalPlayers) * 100),
        4: Math.round((starCounts[4] / totalPlayers) * 100),
        3: Math.round((starCounts[3] / totalPlayers) * 100),
        2: Math.round((starCounts[2] / totalPlayers) * 100),
        1: Math.round((starCounts[1] / totalPlayers) * 100),
      },
    };
  });

  const sortedTeams = [...teams].sort((a, b) => b.rating - a.rating);

  return {
    info: league.info,
    team: teams.find(entry => entry.name === league.info.team) ?? teams[0],
    conferences: league.conferences,
    prestige_stars_table,
    team_counts_by_prestige,
    total_star_counts,
    teams: sortedTeams,
  };
};

const buildScheduleGameForTeam = (
  team: Team,
  game: {
    id: number;
    teamAId: number;
    teamBId: number;
    homeTeamId: number | null;
    awayTeamId: number | null;
    neutralSite: boolean;
    baseLabel: string;
    spreadA: string;
    spreadB: string;
    moneylineA: string;
    moneylineB: string;
    weekPlayed: number;
    rankATOG: number;
    rankBTOG: number;
    resultA: string | null;
    resultB: string | null;
    scoreA: number | null;
    scoreB: number | null;
    winnerId: number | null;
  },
  teamsById: Map<number, Team>
) => {
  const isTeamA = game.teamAId === team.id;
  const opponentId = isTeamA ? game.teamBId : game.teamAId;
  const opponent = teamsById.get(opponentId);
  if (!opponent) return null;

  const scoreA = game.scoreA ?? 0;
  const scoreB = game.scoreB ?? 0;
  const score = game.winnerId
    ? isTeamA
      ? `${scoreA}-${scoreB}`
      : `${scoreB}-${scoreA}`
    : '';

  const location = game.neutralSite
    ? 'Neutral'
    : game.homeTeamId === team.id
      ? 'Home'
      : game.awayTeamId === team.id
        ? 'Away'
        : undefined;

  return {
    weekPlayed: game.weekPlayed,
    opponent: {
      name: opponent.name,
      rating: opponent.rating,
      ranking: opponent.ranking,
      record: opponent.record,
    },
    label: game.baseLabel,
    result: isTeamA ? game.resultA ?? '' : game.resultB ?? '',
    score,
    spread: isTeamA ? game.spreadA : game.spreadB,
    moneyline: isTeamA ? game.moneylineA : game.moneylineB,
    id: `${game.id}`,
    location,
  } as const;
};

const sortStandings = (teams: Team[]) => {
  return teams.slice().sort((a, b) => {
    const aConfGames = a.confWins + a.confLosses;
    const bConfGames = b.confWins + b.confLosses;
    const aConfPct = aConfGames ? a.confWins / aConfGames : 0;
    const bConfPct = bConfGames ? b.confWins / bConfGames : 0;
    if (bConfPct !== aConfPct) return bConfPct - aConfPct;
    if (b.confWins !== a.confWins) return b.confWins - a.confWins;
    if (a.confLosses !== b.confLosses) return a.confLosses - b.confLosses;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    if (a.totalLosses !== b.totalLosses) return a.totalLosses - b.totalLosses;
    return a.ranking - b.ranking;
  });
};

export const loadStandings = async (conferenceName: string) => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const normalized = conferenceName.toLowerCase();
  const isIndependent = normalized === 'independent';
  const conference = isIndependent
    ? null
    : league.conferences.find(conf => conf.confName.toLowerCase() === normalized) ?? null;

  const teams = isIndependent
    ? league.teams.filter(team => team.conference === 'Independent')
    : league.teams.filter(team => team.conference === conference?.confName);

  const games = await getAllGames();
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const rankedTeams = sortStandings(teams).map(team => {
    const lastWeek = league.info.currentWeek - 1;
    const currentWeek = league.info.currentWeek;
    const lastGameRecord = games.find(
      game =>
        game.weekPlayed === lastWeek &&
        (game.teamAId === team.id || game.teamBId === team.id)
    );
    const nextGameRecord = games.find(
      game =>
        game.weekPlayed === currentWeek &&
        (game.teamAId === team.id || game.teamBId === team.id)
    );

    const last_game =
      lastGameRecord && lastGameRecord.winnerId
        ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
        : null;
    const next_game = nextGameRecord
      ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
      : null;

    return {
      ...team,
      last_game,
      next_game,
    };
  });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conference: conference?.confName ?? 'Independent',
    teams: rankedTeams,
    conferences: league.conferences,
  };
};

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
    {
      year: league.info.currentYear,
      prestige: team.prestige,
      rating: team.rating,
      conference: team.conference,
      wins: team.totalWins,
      losses: team.totalLosses,
      rank: team.ranking,
      has_games: true,
    },
    ...historicalRows,
  ];

  return {
    info: league.info,
    team,
    years,
    conferences: league.conferences,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
  };
};

export const loadRankings = async () => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const games = await getAllGames();
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const rankings = league.teams
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .map(team => {
      const lastWeek = league.info.currentWeek - 1;
      const currentWeek = league.info.currentWeek;
      const lastGameRecord = games.find(
        game =>
          game.weekPlayed === lastWeek &&
          (game.teamAId === team.id || game.teamBId === team.id)
      );
      const nextGameRecord = games.find(
        game =>
          game.weekPlayed === currentWeek &&
          (game.teamAId === team.id || game.teamBId === team.id)
      );

      const last_game =
        lastGameRecord && lastGameRecord.winnerId
          ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
          : null;
      const next_game = nextGameRecord
        ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
        : null;

      return {
        ...team,
        movement: team.last_rank ? team.last_rank - team.ranking : 0,
        last_game,
        next_game,
      };
    });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    rankings,
    conferences: league.conferences,
  };
};

export const loadSettings = async () => {
  const league = await loadLeagueOrThrow();

  const changed = ensureSettings(league);
  if (changed) {
    await saveLeague(league);
  }

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    settings: league.settings ?? { ...DEFAULT_SETTINGS },
  };
};


const average = (total: number, attempts: number, decimals = 1) => {
  if (!attempts) return 0;
  const factor = 10 ** decimals;
  return Math.round((total / attempts) * factor) / factor;
};

const percentage = (completions: number, attempts: number) => {
  if (!attempts) return 0;
  return Math.round((completions / attempts) * 1000) / 10;
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

  logs.forEach(({ log }) => {
    yearStats.pass_completions += log.pass_completions;
    yearStats.pass_attempts += log.pass_attempts;
    yearStats.pass_yards += log.pass_yards;
    yearStats.pass_touchdowns += log.pass_touchdowns;
    yearStats.pass_interceptions += log.pass_interceptions;

    yearStats.rush_attempts += log.rush_attempts;
    yearStats.rush_yards += log.rush_yards;
    yearStats.rush_touchdowns += log.rush_touchdowns;

    yearStats.receiving_catches += log.receiving_catches;
    yearStats.receiving_yards += log.receiving_yards;
    yearStats.receiving_touchdowns += log.receiving_touchdowns;

    yearStats.field_goals_made += log.field_goals_made;
    yearStats.field_goals_attempted += log.field_goals_attempted;
  });

  if (!player.active && year === currentYear) {
    (yearStats as any).class = player.year;
    (yearStats as any).rating = player.rating;
  } else {
    const info = getPlayerInfoForYear(player, currentYear, year);
    (yearStats as any).class = info.classYear;
    (yearStats as any).rating = info.rating;
  }

  (yearStats as any).completion_percentage = percentage(
    yearStats.pass_completions,
    yearStats.pass_attempts
  );
  (yearStats as any).adjusted_pass_yards_per_attempt = adjustedPassYardsPerAttempt(
    yearStats.pass_yards,
    yearStats.pass_touchdowns,
    yearStats.pass_interceptions,
    yearStats.pass_attempts
  );
  (yearStats as any).passer_rating = passerRating(
    yearStats.pass_completions,
    yearStats.pass_attempts,
    yearStats.pass_yards,
    yearStats.pass_touchdowns,
    yearStats.pass_interceptions
  );
  (yearStats as any).yards_per_rush = average(yearStats.rush_yards, yearStats.rush_attempts);
  (yearStats as any).yards_per_rec = average(
    yearStats.receiving_yards,
    yearStats.receiving_catches
  );
  (yearStats as any).field_goal_percent = percentage(
    yearStats.field_goals_made,
    yearStats.field_goals_attempted
  );

  return yearStats;
};

const getPlayerYears = (
  player: PlayerRecord,
  currentYear: number,
  playerLogs: GameLogRecord[],
  gamesById: Map<number, GameRecord>
) => {
  if (!player.active) {
    const years = new Set<number>();
    playerLogs.forEach(log => {
      const game = gamesById.get(log.gameId);
      if (game) years.add(game.year);
    });
    const list = Array.from(years).sort((a, b) => b - a);
    return list.length ? list : [currentYear];
  }

  const yearMapping: Record<string, number[]> = {
    fr: [currentYear],
    so: [currentYear, currentYear - 1],
    jr: [currentYear, currentYear - 1, currentYear - 2],
    sr: [currentYear, currentYear - 1, currentYear - 2, currentYear - 3],
  };
  return (yearMapping[player.year] ?? [currentYear]).filter(year => year <= currentYear);
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
