import type { Conference, Info, ScheduleGame, Team } from '../../types/domain';
import { getYearsIndex } from '../../db/baseData';
import { loadLeague, saveLeague } from '../../db/leagueRepo';
import {
  clearAllSimData,
  getAllGames,
  getAllPlayers,  
  getGameById,
  getDrivesByGame,
  getPlaysByGame,
  saveGames,
} from '../../db/simRepo';
import { initializeRosters, ensureRosters } from '../roster';
import { buildPreviewData, buildTeamsAndConferences } from '../baseData';
import {
  buildSchedule,
  applyRivalriesToSchedule,
  fillUserSchedule,
  buildUserScheduleFromGames,
  listAvailableTeams as listTeamsForWeek,
  scheduleNonConGame as scheduleGameForWeek,
} from '../schedule';
import { buildDriveResponse, initializeSimData } from '../sim';
import { DEFAULT_SETTINGS, ensureSettings, type LaunchProps, type LeagueState, type NonConData } from '../../types/league';
import { getLastWeekByPlayoffTeams } from './postseason';
import { normalizeLeague } from './normalize';
import type { GameRecord } from '../../types/db';
import { buildOddsFields, loadOddsContext } from '../odds';
import { buildBaseLabel } from '../gameHelpers';

const createNonConGameRecord = async (
  league: LeagueState,
  teamA: Team,
  teamB: Team,
  weekPlayed: number,
  name?: string | null,
  options?: { neutralSite?: boolean; homeTeam?: Team | null; awayTeam?: Team | null }
): Promise<GameRecord> => {
  const oddsContext = await loadOddsContext();

  const neutralSite = options?.neutralSite ?? false;
  const homeTeam = neutralSite ? null : options?.homeTeam ?? teamA;
  const awayTeam = neutralSite ? null : options?.awayTeam ?? teamB;

  const oddsFields = buildOddsFields(teamA, teamB, homeTeam, neutralSite, oddsContext);

  if (!league.idCounters) {
    league.idCounters = { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 };
  }
  const id = league.idCounters.game ?? 1;
  league.idCounters.game = id + 1;

  return {
    id,
    teamAId: teamA.id,
    teamBId: teamB.id,
    homeTeamId: homeTeam?.id ?? null,
    awayTeamId: awayTeam?.id ?? null,
    neutralSite,
    winnerId: null,
    baseLabel: buildBaseLabel(teamA, teamB, name ?? null),
    name: name ?? null,
    ...oddsFields,
    weekPlayed,
    year: league.info.currentYear,
    rankATOG: teamA.ranking,
    rankBTOG: teamB.ranking,
    resultA: null,
    resultB: null,
    overtime: 0,
    scoreA: null,
    scoreB: null,
    headline: null,
    watchability: null,
  };
};

const loadLeagueOrThrow = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  const changed = normalizeLeague(league);
  if (changed) await saveLeague(league);
  return league;
};

const loadLeagueOptional = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) return null;
  const changed = normalizeLeague(league);
  if (changed) await saveLeague(league);
  return league;
};

const getUserSchedule = async (league: LeagueState, weeks?: number) => {
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const games = await getAllGames();
  return buildUserScheduleFromGames(userTeam, league.teams, games, weeks);
};

export const loadHomeData = async (year?: string): Promise<LaunchProps> => {
  const yearsIndex = await getYearsIndex();
  const years = yearsIndex.years;
  const selectedYear = year || years[0] || null;
  const preview = selectedYear ? await buildPreviewData(selectedYear) : null;
  const league = await loadLeagueOptional();

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
    lastWeek: getLastWeekByPlayoffTeams(DEFAULT_SETTINGS.playoff_teams),
    colorPrimary: userTeam?.colorPrimary,
    colorSecondary: userTeam?.colorSecondary,
  };

  const league: LeagueState = {
    info,
    teams,
    conferences,
    pending_rivalries: [],
    scheduleBuilt: false,
    simInitialized: false,
    settings: { ...DEFAULT_SETTINGS },
    playoff: { seeds: [] },
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: 1,
    },
  };

  ensureLeaguePostseasonState(league);
  await initializeRosters(league);

  const schedule = buildSchedule();
  league.pending_rivalries = await applyRivalriesToSchedule(
    schedule,
    userTeam,
    teams
  );

  const created = await Promise.all(
    schedule
      .filter(slot => slot.opponent)
      .map(slot => {
        const opponent = teams.find(team => team.name === slot.opponent?.name);
        if (!opponent) return null;
        userTeam.nonConfGames += 1;
        opponent.nonConfGames += 1;
        return createNonConGameRecord(
          league,
          userTeam,
          opponent,
          slot.weekPlayed,
          slot.label ?? null,
          { neutralSite: true }
        );
      })
  );
  const gamesToSave = created.filter(Boolean) as GameRecord[];
  if (gamesToSave.length) {
    await saveGames(gamesToSave);
  }

  await saveLeague(league);

  return {
    info: league.info,
    team: userTeam,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};

export const loadNonCon = async (): Promise<NonConData> => {
  const league = await loadLeagueOrThrow();
  const team = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const schedule = await getUserSchedule(league);
  return {
    info: league.info,
    team,
    schedule,
    pending_rivalries: league.pending_rivalries,
    conferences: league.conferences,
  };
};

export const loadDashboard = async () => {
  const league = await loadLeagueOrThrow();

  if (!league.scheduleBuilt) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const schedule = await getUserSchedule(league);
    const fullGames = fillUserSchedule(schedule, userTeam, league.teams);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, fullGames);
  }

  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const confTeams = league.teams
    .filter(team => team.conference === userTeam.conference)
    .sort((a, b) => a.ranking - b.ranking);

  const top10 = [...league.teams].sort((a, b) => a.ranking - b.ranking).slice(0, 10);

  const schedule = await getUserSchedule(league, league.info.lastWeek || 14);
  const currentWeekIndex = Math.max(league.info.currentWeek - 1, 0);
  const prevGame = currentWeekIndex > 0 ? schedule[currentWeekIndex - 1] : null;
  const currGame = schedule[currentWeekIndex] ?? null;

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
  const league = await loadLeagueOrThrow();

  if (!league.scheduleBuilt) {
    const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
    const schedule = await getUserSchedule(league);
    const fullGames = fillUserSchedule(schedule, userTeam, league.teams);
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

  const totalWeeks = league.info.lastWeek || 14;
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

export const loadWeekSchedule = async (week: number) => {
  const league = await loadLeagueOrThrow();

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
  const league = await loadLeagueOrThrow();

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
  const league = await loadLeagueOrThrow();

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

export const loadAwards = async () => {
  const league = await loadLeagueOrThrow();

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    favorites: [],
    final: [],
  };
};

export const loadSeasonSummary = async () => {
  const league = await loadLeagueOrThrow();

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    champion: null,
    awards: [],
    teams: league.teams,
  };
};

export const getTeamInfo = async (teamName: string): Promise<Team | null> => {
  const league = await loadLeagueOptional();
  if (!league) return null;
  return league.teams.find(team => team.name === teamName) ?? null;
};

export const listAvailableTeams = async (week: number): Promise<string[]> => {
  const league = await loadLeagueOptional();
  if (!league) return [];

  const userTeam = league.teams.find(team => team.name === league.info.team);
  if (!userTeam) return [];

  const schedule = await getUserSchedule(league);
  return listTeamsForWeek(schedule, userTeam, league.teams, week);
};

export const scheduleNonConGame = async (opponentName: string, week: number): Promise<void> => {
  const league = await loadLeagueOrThrow();

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!userTeam || !opponent) return;

  const schedule = await getUserSchedule(league);
  if (schedule[week - 1]?.opponent) return;
  scheduleGameForWeek(schedule, userTeam, opponent, week);

  const gameRecord = await createNonConGameRecord(
    league,
    userTeam,
    opponent,
    week,
    schedule[week - 1]?.label ?? null,
    { neutralSite: false, homeTeam: userTeam, awayTeam: opponent }
  );

  await saveGames([gameRecord]);
  await saveLeague(league);
};
