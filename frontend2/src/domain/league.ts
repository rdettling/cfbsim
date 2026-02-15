import type { Conference, Info, ScheduleGame, Team } from './types';
import { getConferencesData, getRivalriesData, getTeamsData, getYearData, getYearsIndex } from '../db/baseData';
import { loadLeague, saveLeague } from '../db/leagueRepo';

export interface PreviewData {
  conferences: Record<
    string,
    {
      confName: string;
      confFullName: string;
      confGames: number;
      teams: Team[];
    }
  >;
  independents: Team[];
  playoff: {
    teams: number;
    conf_champ_autobids: number;
    conf_champ_top_4: boolean;
  };
}

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
}

interface YearData {
  playoff: {
    teams: number;
    conf_champ_autobids?: number;
    conf_champ_top_4?: boolean;
  };
  conferences: Record<string, { games: number; teams: Record<string, number> }>;
  Independent?: Record<string, number>;
}

interface TeamsData {
  teams: Record<
    string,
    {
      mascot: string;
      abbreviation: string;
      ceiling: number;
      floor: number;
      colorPrimary: string;
      colorSecondary: string;
      city?: string;
      state?: string;
      stadium?: string;
    }
  >;
}

type ConferencesData = Record<string, string>;

const buildPreviewData = async (year: string): Promise<PreviewData> => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(year),
    getTeamsData(),
    getConferencesData(),
  ]);
  const typedYearData = yearData as YearData;
  const typedTeamsData = teamsData as TeamsData;
  const typedConferencesData = conferencesData as ConferencesData;

  const addTeamMetadata = (teamName: string, prestige: number): Team => {
    const meta = typedTeamsData.teams[teamName];
    return {
      id: 0,
      name: teamName,
      abbreviation: meta.abbreviation,
      nonConfGames: 0,
      nonConfLimit: 0,
      prestige,
      prestige_change: 0,
      ceiling: meta.ceiling,
      floor: meta.floor,
      mascot: meta.mascot,
      ranking: 0,
      offense: 90,
      defense: 90,
      colorPrimary: meta.colorPrimary,
      colorSecondary: meta.colorSecondary,
      conference: '',
      confName: '',
      confWins: 0,
      confLosses: 0,
      rating: 90,
      totalWins: 0,
      totalLosses: 0,
      record: '0-0 (0-0)',
      movement: 0,
      poll_score: 0,
      strength_of_record: 0,
      last_game: null,
      next_game: null,
    };
  };

  const conferences: PreviewData['conferences'] = {};
  Object.entries(typedYearData.conferences || {}).forEach(([confName, confData]) => {
    const teams = Object.entries(confData.teams || {}).map(
      ([teamName, prestige]) => addTeamMetadata(teamName, prestige as number)
    );
    teams.sort((a, b) => b.prestige - a.prestige);

    conferences[confName] = {
      ...confData,
      confName,
      confFullName: typedConferencesData[confName] ?? confName,
      confGames: confData.games,
      teams,
    };
  });

  const independents = Object.entries(typedYearData.Independent || {}).map(
    ([teamName, prestige]) => addTeamMetadata(teamName, prestige as number)
  );

  return {
    playoff: {
      teams: typedYearData.playoff.teams,
      conf_champ_autobids: typedYearData.playoff.conf_champ_autobids ?? 0,
      conf_champ_top_4: typedYearData.playoff.conf_champ_top_4 ?? false,
    },
    conferences,
    independents,
  };
};

const buildTeamsAndConferences = async (year: string) => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(year),
    getTeamsData(),
    getConferencesData(),
  ]);
  const typedYearData = yearData as YearData;
  const typedTeamsData = teamsData as TeamsData;
  const typedConferencesData = conferencesData as ConferencesData;

  const teams: Team[] = [];
  const conferences: Conference[] = [];
  let teamId = 1;
  let conferenceId = 1;

  const makeTeam = (
    teamName: string,
    prestige: number,
    conferenceName: string | null,
    confGames: number
  ): Team => {
    const meta = typedTeamsData.teams[teamName];
    const team: Team = {
      id: teamId,
      name: teamName,
      abbreviation: meta.abbreviation,
      nonConfGames: 0,
      nonConfLimit: 12 - confGames,
      prestige,
      prestige_change: 0,
      ceiling: meta.ceiling,
      floor: meta.floor,
      mascot: meta.mascot,
      ranking: 0,
      offense: 90,
      defense: 90,
      colorPrimary: meta.colorPrimary,
      colorSecondary: meta.colorSecondary,
      conference: conferenceName ?? 'Independent',
      confName: conferenceName ?? 'Independent',
      confWins: 0,
      confLosses: 0,
      rating: 90,
      totalWins: 0,
      totalLosses: 0,
      record: '0-0 (0-0)',
      movement: 0,
      poll_score: 0,
      strength_of_record: 0,
      last_game: null,
      next_game: null,
    };
    teamId += 1;
    return team;
  };

  Object.entries(typedYearData.conferences).forEach(([confName, confData]) => {
    const confTeams: Team[] = [];
    Object.entries(confData.teams).forEach(([teamName, prestige]) => {
      const team = makeTeam(teamName, prestige as number, confName, confData.games);
      teams.push(team);
      confTeams.push(team);
    });

    conferences.push({
      id: conferenceId,
      confName,
      confFullName: typedConferencesData[confName] ?? confName,
      confGames: confData.games,
      info: '',
      championship: null,
      teams: confTeams,
    });
    conferenceId += 1;
  });

  const independents = typedYearData.Independent ?? {};
  if (Object.keys(independents).length) {
    const confTeams: Team[] = [];
    Object.entries(independents).forEach(([teamName, prestige]) => {
      const team = makeTeam(teamName, prestige as number, null, 0);
      teams.push(team);
      confTeams.push(team);
    });

    conferences.push({
      id: conferenceId,
      confName: 'Independent',
      confFullName: 'Independent',
      confGames: 0,
      info: '',
      championship: null,
      teams: confTeams,
    });
  }

  teams
    .sort((a, b) => b.prestige - a.prestige)
    .forEach((team, index) => {
      team.ranking = index + 1;
    });

  return { teams, conferences };
};

const buildSchedule = (): ScheduleGame[] =>
  Array.from({ length: 14 }, (_, index) => ({
    weekPlayed: index + 1,
    opponent: null,
    result: '',
    score: '',
    spread: '',
    moneyline: '',
    id: '',
  }));

const applyRivalriesToSchedule = async (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[]
): Promise<NonConData['pending_rivalries']> => {
  const rivalries = await getRivalriesData();
  let pendingId = 1;
  const pending: NonConData['pending_rivalries'] = [];

  const teamByName = new Map(teams.map(team => [team.name, team]));

  rivalries.rivalries.forEach(([teamA, teamB, week, name]) => {
    if (teamA !== userTeam.name && teamB !== userTeam.name) return;
    const opponentName = teamA === userTeam.name ? teamB : teamA;
    const opponent = teamByName.get(opponentName);
    if (!opponent) return;

    if (week) {
      const slot = schedule[week - 1];
      if (!slot.opponent) {
        slot.opponent = {
          name: opponent.name,
          rating: opponent.rating,
          ranking: opponent.ranking,
          record: opponent.record,
        };
        slot.label = name ?? 'Rivalry';
        slot.id = `${userTeam.name}-vs-${opponent.name}-week-${week}`;
      }
      return;
    }

    pending.push({
      id: pendingId,
      teamA,
      teamB,
      name: name ?? null,
      homeTeam: null,
      awayTeam: null,
    });
    pendingId += 1;
  });

  return pending;
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
  };

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

  const weekIndex = week - 1;
  const weekSlot = league.schedule[weekIndex];
  if (!weekSlot || weekSlot.opponent) return [];

  const scheduledTeamIds = new Set<string>();
  league.schedule.forEach(slot => {
    if (slot.opponent) {
      scheduledTeamIds.add(slot.opponent.name);
    }
  });

  const alreadyPlayed = new Set<string>();
  league.schedule.forEach(slot => {
    if (slot.opponent) {
      alreadyPlayed.add(slot.opponent.name);
    }
  });

  return league.teams
    .filter(team => team.name !== userTeam.name)
    .filter(team => team.nonConfGames < team.nonConfLimit)
    .filter(team => !scheduledTeamIds.has(team.name))
    .filter(team => !alreadyPlayed.has(team.name))
    .filter(team => team.conference !== userTeam.conference)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(team => team.name);
};

export const scheduleNonConGame = async (
  opponentName: string,
  week: number
): Promise<void> => {
  const league = await loadLeague<LeagueState>();
  if (!league) throw new Error('No league found. Start a new game from the Home page.');

  const userTeam = league.teams.find(team => team.name === league.info.team);
  const opponent = league.teams.find(team => team.name === opponentName);
  if (!userTeam || !opponent) return;

  const weekIndex = week - 1;
  const slot = league.schedule[weekIndex];
  if (!slot || slot.opponent) return;

  slot.opponent = {
    name: opponent.name,
    rating: opponent.rating,
    ranking: opponent.ranking,
    record: opponent.record,
  };
  slot.label = userTeam.conference === opponent.conference
    ? `C (${userTeam.conference})`
    : opponent.conference
      ? `NC (${opponent.conference})`
      : 'NC (Ind)';
  slot.location = 'Home';
  slot.id = `${userTeam.name}-vs-${opponent.name}-week-${week}`;

  userTeam.nonConfGames += 1;
  opponent.nonConfGames += 1;

  await saveLeague(league);
};
