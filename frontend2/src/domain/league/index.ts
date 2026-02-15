import type { Conference, Info, ScheduleGame, Team, Settings } from '../types';
import { getYearsIndex } from '../../db/baseData';
import { loadLeague, saveLeague } from '../../db/leagueRepo';
import {
  clearAllSimData,
  getAllGames,
  getAllPlayers,
  getAllPlays,
  getAllGameLogs,
  getGameById,
  getDrivesByGame,
  getPlaysByGame,
} from '../../db/simRepo';
import { initializeRosters, ensureRosters } from '../roster';
import { buildPreviewData, buildTeamsAndConferences, type PreviewData } from '../baseData';
import {
  buildSchedule,
  applyRivalriesToSchedule,
  fillUserSchedule,
  listAvailableTeams as listTeamsForWeek,
  scheduleNonConGame as scheduleGameForWeek,
} from '../schedule';
import { buildDriveResponse, initializeSimData } from '../sim';

export interface LaunchProps {
  years: string[];
  info: Info | null;
  preview: PreviewData | null;
  selected_year?: string | null;
}

export interface NonConData {
  info: Info;
  team: Team;
  schedule: ScheduleGame[];
  pending_rivalries: Array<{
    id: number;
    teamA: string;
    teamB: string;
    name: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
  }>;
  conferences: Conference[];
}

interface LeagueState {
  info: Info;
  teams: Team[];
  conferences: Conference[];
  schedule: ScheduleGame[];
  pending_rivalries: NonConData['pending_rivalries'];
  scheduleBuilt?: boolean;
  simInitialized?: boolean;
  settings?: Settings;
  idCounters?: {
    game: number;
    drive: number;
    play: number;
    gameLog: number;
    player: number;
  };
}

const DEFAULT_SETTINGS: Settings = {
  playoff_teams: 12,
  playoff_autobids: 6,
  playoff_conf_champ_top_4: true,
  auto_realignment: true,
  auto_update_postseason_format: true,
};

const ensureSettings = (league: LeagueState) => {
  if (!league.settings) {
    league.settings = { ...DEFAULT_SETTINGS };
    return true;
  }
  return false;
};

export const loadHomeData = async (year?: string): Promise<LaunchProps> => {
  const yearsIndex = await getYearsIndex();
  const years = yearsIndex.years;
  const selectedYear = year || years[0] || null;
  const preview = selectedYear ? await buildPreviewData(selectedYear) : null;
  const league = await loadLeague<LeagueState>();

  return {
    info: league?.info ?? null,
    years,
    preview,
    selected_year: selectedYear,
  };
};

export const startNewLeague = async (teamName: string, year: string): Promise<NonConData> => {
  await clearAllSimData();
  const { teams, conferences } = await buildTeamsAndConferences(year);
  const userTeam = teams.find(team => team.name === teamName) ?? teams[0];

  const info: Info = {
    currentWeek: 1,
    currentYear: Number(year),
    stage: 'preseason',
    team: userTeam?.name ?? '',
    lastWeek: 14,
    colorPrimary: userTeam?.colorPrimary,
    colorSecondary: userTeam?.colorSecondary,
  };

  const league: LeagueState = {
    info,
    teams,
    conferences,
    schedule: buildSchedule(),
    pending_rivalries: [],
    scheduleBuilt: false,
    simInitialized: false,
    settings: { ...DEFAULT_SETTINGS },
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: 1,
    },
  };

  await initializeRosters(league);

  league.pending_rivalries = await applyRivalriesToSchedule(
    league.schedule,
    userTeam,
    teams
  );

  await saveLeague(league);

  return {
    info: league.info,
    team: userTeam,
    schedule: league.schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};

export const loadNonCon = async (): Promise<NonConData> => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  const team = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  return {
    info: league.info,
    team,
    schedule: league.schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};

export const loadDashboard = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  if (!league.scheduleBuilt) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const fullGames = fillUserSchedule(league.schedule, userTeam, league.teams);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, fullGames);
  }

  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const confTeams = league.teams
    .filter(team => team.conference === userTeam.conference)
    .sort((a, b) => a.ranking - b.ranking);

  const top10 = [...league.teams].sort((a, b) => a.ranking - b.ranking).slice(0, 10);

  const currentWeekIndex = Math.max(league.info.currentWeek - 1, 0);
  const prevGame = currentWeekIndex > 0 ? league.schedule[currentWeekIndex - 1] : null;
  const currGame = league.schedule[currentWeekIndex] ?? null;

  return {
    info: league.info,
    prev_game: prevGame,
    curr_game: currGame,
    team: userTeam,
    confTeams,
    top_10: top10,
    top_games: [],
    conferences: league.conferences,
  };
};

export const loadTeamSchedule = async (teamName?: string) => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  if (!league.scheduleBuilt) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const fullGames = fillUserSchedule(league.schedule, userTeam, league.teams);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, fullGames);
  }

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const games = await getAllGames();
  const teamGames = games.filter(
    game => game.teamAId === team.id || game.teamBId === team.id
  );
  const gamesByWeek = new Map<number, (typeof teamGames)[number]>();
  teamGames.forEach(game => {
    if (game.weekPlayed && game.weekPlayed > 0) {
      gamesByWeek.set(game.weekPlayed, game);
    }
  });

  const totalWeeks = league.info.lastWeek || league.schedule.length || 14;
  const schedule = Array.from({ length: totalWeeks }, (_, index) => {
    const week = index + 1;
    const game = gamesByWeek.get(week);
    if (!game) {
      return {
        weekPlayed: week,
        opponent: null,
        result: '',
        score: '',
        spread: '',
        moneyline: '',
        id: '',
      };
    }

    const opponentId = game.teamAId === team.id ? game.teamBId : game.teamAId;
    const opponent = league.teams.find(entry => entry.id === opponentId);
    const isHome = game.homeTeamId === team.id;
    const isAway = game.awayTeamId === team.id;
    const location = game.neutralSite
      ? 'Neutral'
      : isHome
        ? 'Home'
        : isAway
          ? 'Away'
          : undefined;

    const isTeamA = game.teamAId === team.id;
    const scoreA = game.scoreA ?? 0;
    const scoreB = game.scoreB ?? 0;
    const score = game.winnerId
      ? isTeamA
        ? `${scoreA}-${scoreB}`
        : `${scoreB}-${scoreA}`
      : '';

    return {
      weekPlayed: week,
      opponent: opponent
        ? {
            name: opponent.name,
            rating: opponent.rating,
            ranking: opponent.ranking,
            record: opponent.record,
          }
        : null,
      label: game.baseLabel,
      result: game.winnerId
        ? game.winnerId === team.id
          ? 'W'
          : 'L'
        : '',
      score,
      spread: isTeamA ? game.spreadA : game.spreadB,
      moneyline: isTeamA ? game.moneylineA : game.moneylineB,
      id: `${game.id}`,
      location,
    };
  });

  return {
    info: league.info,
    team,
    games: schedule,
    conferences: league.conferences,
    teams: league.teams.map(entry => entry.name).sort((a, b) => a.localeCompare(b)),
  };
};

export const loadRatingsStats = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

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
      const star = Math.min(5, Math.max(1, player.stars || 1));
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
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

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

export const loadWeekSchedule = async (week: number) => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  await ensureRosters(league);
  await saveLeague(league);

  const games = await getAllGames();
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const weekGames = games
    .filter(game => game.weekPlayed === week)
    .map(game => {
      const teamA = teamsById.get(game.teamAId)!;
      const teamB = teamsById.get(game.teamBId)!;
      return {
        id: game.id,
        label: game.baseLabel,
        base_label: game.baseLabel,
        teamA,
        teamB,
        rankATOG: game.rankATOG,
        rankBTOG: game.rankBTOG,
        scoreA: game.scoreA ?? undefined,
        scoreB: game.scoreB ?? undefined,
        spreadA: game.spreadA,
        spreadB: game.spreadB,
        winner: Boolean(game.winnerId),
        overtime: game.overtime,
        watchability: game.watchability ?? 0,
      };
    })
    .sort((a, b) => b.watchability - a.watchability);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    games: weekGames,
    conferences: league.conferences,
  };
};

export const loadGame = async (gameId: number) => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  const record = await getGameById(gameId);
  if (!record) {
    throw new Error('Game not found.');
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const teamA = teamsById.get(record.teamAId);
  const teamB = teamsById.get(record.teamBId);
  if (!teamA || !teamB) {
    throw new Error('Game teams not found.');
  }

  const game = {
    id: record.id,
    label: record.baseLabel,
    base_label: record.baseLabel,
    name: record.name,
    weekPlayed: record.weekPlayed,
    year: record.year,
    teamA,
    teamB,
    rankATOG: record.rankATOG,
    rankBTOG: record.rankBTOG,
    spreadA: record.spreadA,
    spreadB: record.spreadB,
    moneylineA: record.moneylineA,
    moneylineB: record.moneylineB,
    winProbA: record.winProbA,
    winProbB: record.winProbB,
    winnerId: record.winnerId,
    scoreA: record.scoreA ?? 0,
    scoreB: record.scoreB ?? 0,
    resultA: record.resultA ?? '',
    resultB: record.resultB ?? '',
    overtime: record.overtime ?? 0,
    headline: record.headline ?? null,
  };

  const drives = record.winnerId
    ? buildDriveResponse(
        await getDrivesByGame(gameId),
        await getPlaysByGame(gameId),
        teamsById
      )
    : [];

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    game,
    drives,
  };
};

export const loadTeamRoster = async (teamName?: string) => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  await ensureRosters(league);
  await saveLeague(league);

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

  const roster = (await getAllPlayers()).filter(
    player => player.active && player.teamId === team.id
  );

  const positions = Array.from(
    new Set(roster.map(player => player.pos))
  ).sort((a, b) => a.localeCompare(b));

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
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  const team =
    (teamName ? league.teams.find(entry => entry.name === teamName) : null) ??
    league.teams.find(entry => entry.name === league.info.team) ??
    league.teams[0];

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
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

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
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

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

export const loadAwards = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    favorites: [],
    final: [],
  };
};

export const loadSeasonSummary = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    champion: null,
    awards: [],
    teams: league.teams,
  };
};

const MIN_YARDS = 100;

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

export const getTeamInfo = async (teamName: string): Promise<Team | null> => {
  const league = await loadLeague<LeagueState>();
  if (!league) return null;
  return league.teams.find(team => team.name === teamName) ?? null;
};

export const listAvailableTeams = async (week: number): Promise<string[]> => {
  const league = await loadLeague<LeagueState>();
  if (!league) return [];

  const userTeam = league.teams.find(team => team.name === league.info.team);
  if (!userTeam) return [];

  return listTeamsForWeek(league.schedule, userTeam, league.teams, week);
};

export const scheduleNonConGame = async (opponentName: string, week: number): Promise<void> => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game from the Home page.');

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!userTeam || !opponent) return;

  scheduleGameForWeek(league.schedule, userTeam, opponent, week);
  await saveLeague(league);
};
