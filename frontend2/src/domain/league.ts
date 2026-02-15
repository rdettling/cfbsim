import type { Conference, Info, ScheduleGame, Team } from '../interfaces';
import { getConferencesData, getTeamsData, getYearData, getYearsIndex } from '../data/baseData';
import { loadLeague, saveLeague } from '../data/leagueRepo';

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

const buildPreviewData = async (year: string): Promise<PreviewData> => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(year),
    getTeamsData(),
    getConferencesData(),
  ]);

  const addTeamMetadata = (teamName: string, prestige: number): Team => {
    const meta = teamsData.teams[teamName];
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
  Object.entries(yearData.conferences || {}).forEach(([confName, confData]) => {
    const teams = Object.entries(confData.teams || {}).map(
      ([teamName, prestige]) => addTeamMetadata(teamName, prestige as number)
    );
    teams.sort((a, b) => b.prestige - a.prestige);

    conferences[confName] = {
      ...confData,
      confName,
      confFullName: conferencesData[confName] ?? confName,
      confGames: confData.games,
      teams,
    };
  });

  const independents = Object.entries(yearData.Independent || {}).map(
    ([teamName, prestige]) => addTeamMetadata(teamName, prestige as number)
  );

  return {
    playoff: {
      teams: yearData.playoff.teams,
      conf_champ_autobids: yearData.playoff.conf_champ_autobids ?? 0,
      conf_champ_top_4: yearData.playoff.conf_champ_top_4 ?? false,
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
    const meta = teamsData.teams[teamName];
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

  Object.entries(yearData.conferences).forEach(([confName, confData]) => {
    const confTeams: Team[] = [];
    Object.entries(confData.teams).forEach(([teamName, prestige]) => {
      const team = makeTeam(teamName, prestige as number, confName, confData.games);
      teams.push(team);
      confTeams.push(team);
    });

    conferences.push({
      id: conferenceId,
      confName,
      confFullName: conferencesData[confName] ?? confName,
      confGames: confData.games,
      info: '',
      championship: null,
      teams: confTeams,
    });
    conferenceId += 1;
  });

  const independents = yearData.Independent ?? {};
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
