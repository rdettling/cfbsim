import type { Conference, Team } from '../types/domain';
import { getConferencesData, getTeamsData, getYearData } from '../db/baseData';

export interface YearData {
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

export const buildPreviewData = async (year: string): Promise<PreviewData> => {
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
      confGames: 0,
      confLimit: 0,
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
      nonConfWins: 0,
      nonConfLosses: 0,
      rating: 90,
      totalWins: 0,
      totalLosses: 0,
      gamesPlayed: 0,
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

export const buildTeamsAndConferences = async (year: string): Promise<{ teams: Team[]; conferences: Conference[] }> => {
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
      confGames: 0,
      confLimit: confGames,
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
      nonConfWins: 0,
      nonConfLosses: 0,
      rating: 90,
      totalWins: 0,
      totalLosses: 0,
      gamesPlayed: 0,
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
