import type { Conference, Info, ScheduleGame, Team } from './types';
import { getYearsIndex } from '../db/baseData';
import { getAllGames } from '../db/simRepo';
import { loadLeague, saveLeague } from '../db/leagueRepo';
import { clearAllSimData } from '../db/simRepo';
import { initializeRosters } from './roster';
import { buildPreviewData, buildTeamsAndConferences, type PreviewData } from './baseData';
import {
  buildSchedule,
  applyRivalriesToSchedule,
  fillUserSchedule,
  listAvailableTeams as listTeamsForWeek,
  scheduleNonConGame as scheduleGameForWeek,
} from './schedule';
import { initializeSimData } from './sim';

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
  idCounters?: {
    game: number;
    drive: number;
    play: number;
    gameLog: number;
    player: number;
  };
}

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
