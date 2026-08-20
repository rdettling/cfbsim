import type {
  Conference,
  Team,
  PreviewData,
  PlayoffTeamCount,
} from '../types/domain';
import type { SeasonData, TeamsData, ConferencesData } from '../types/baseData';
import { getConferencesData, getTeamsData, getSeasonData } from '../db/baseData';

export const buildPreviewData = async (year: string): Promise<PreviewData> => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getSeasonData(year),
    getTeamsData(),
    getConferencesData(),
  ]);
  const typedYearData: SeasonData = yearData;
  const typedTeamsData = teamsData as TeamsData;
  const typedConferencesData = conferencesData as ConferencesData;

  const addTeamMetadata = (
    teamName: string,
    prestige: number,
    conferenceName: string | null,
  ): PreviewData['teams'][number] => {
    const meta = typedTeamsData.teams[teamName];
    if (!meta) {
      throw new Error(`Team metadata for ${teamName} is unavailable.`);
    }
    return {
      name: teamName,
      mascot: meta.mascot,
      prestige,
      ceiling: meta.ceiling,
      floor: meta.floor,
      conferenceName,
    };
  };

  const conferences: PreviewData['conferences'] = [];
  const teams: PreviewData['teams'] = [];
  Object.entries(typedYearData.conferences).forEach(([confName, confData]) => {
    teams.push(
      ...Object.entries(confData.teams || {}).map(([teamName, prestige]) =>
        addTeamMetadata(teamName, prestige as number, confName),
      ),
    );
    conferences.push({
      name: confName,
      fullName: typedConferencesData[confName] ?? confName,
      games: confData.games,
    });
  });

  teams.push(
    ...Object.entries(typedYearData.independents).map(
      ([teamName, prestige]) =>
        addTeamMetadata(teamName, prestige as number, null),
    ),
  );
  teams.sort(
    (left, right) =>
      right.prestige - left.prestige || left.name.localeCompare(right.name),
  );
  conferences.sort((left, right) => left.name.localeCompare(right.name));

  return {
    playoff: {
      teams: typedYearData.playoff.teams as PlayoffTeamCount,
      conf_champ_autobids: typedYearData.playoff.conf_champ_autobids,
      conf_champ_top_4: typedYearData.playoff.conf_champ_top_4,
    },
    conferences,
    teams,
  };
};

export const buildTeamsAndConferencesFromData = (
  typedYearData: SeasonData,
  typedTeamsData: TeamsData,
  typedConferencesData: ConferencesData,
): { teams: Team[]; conferences: Conference[] } => {
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
      city: meta.city,
      state: meta.state,
      stadium: meta.stadium,
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
      strength_of_record_avg: 0,
      last_rank: null,
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

  const independents = typedYearData.independents;
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

export const buildTeamsAndConferences = async (
  year: string,
): Promise<{ teams: Team[]; conferences: Conference[] }> => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getSeasonData(year),
    getTeamsData(),
    getConferencesData(),
  ]);
  return buildTeamsAndConferencesFromData(
    yearData,
    teamsData as TeamsData,
    conferencesData as ConferencesData,
  );
};
