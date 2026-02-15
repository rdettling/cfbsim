type YearsIndex = { years: string[] };

type YearData = {
  playoff: {
    teams: number;
    conf_champ_autobids?: number;
    conf_champ_top_4?: boolean;
  };
  conferences: Record<
    string,
    {
      games: number;
      teams: Record<string, number>;
    }
  >;
  Independent?: Record<string, number>;
};

type TeamsData = {
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
};

type ConferencesData = Record<string, string>;

interface LeagueState {
  info: any;
  teams: any[];
  conferences: any[];
  schedule: any[];
  pending_rivalries: any[];
}

const LEAGUE_KEY = 'cfbsim_frontend2_league';

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const getYearsList = async (): Promise<string[]> => {
  const index = await fetchJson<YearsIndex>('/data/years/index.json');
  return index.years;
};

const getTeamsData = async (): Promise<TeamsData> => {
  return fetchJson<TeamsData>('/data/teams.json');
};

const getConferencesData = async (): Promise<ConferencesData> => {
  return fetchJson<ConferencesData>('/data/conferences.json');
};

const getYearData = async (year: string): Promise<YearData> => {
  return fetchJson<YearData>(`/data/years/${year}.json`);
};

const buildPreviewData = async (year: string) => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(year),
    getTeamsData(),
    getConferencesData(),
  ]);

  const addTeamMetadata = (teamName: string, prestige: number) => {
    const meta = teamsData.teams[teamName];
    return {
      name: teamName,
      prestige,
      mascot: meta.mascot,
      abbreviation: meta.abbreviation,
      ceiling: meta.ceiling,
      floor: meta.floor,
      colorPrimary: meta.colorPrimary,
      colorSecondary: meta.colorSecondary,
      city: meta.city ?? null,
      state: meta.state ?? null,
      stadium: meta.stadium ?? null,
    };
  };

  const conferences: Record<string, any> = {};
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
    ...yearData,
    conferences,
    independents,
  };
};

const loadLeague = (): LeagueState | null => {
  const raw = localStorage.getItem(LEAGUE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LeagueState;
  } catch {
    return null;
  }
};

const saveLeague = (league: LeagueState) => {
  localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
};

const buildTeamsAndConferences = async (year: string) => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(year),
    getTeamsData(),
    getConferencesData(),
  ]);

  const teams: any[] = [];
  const conferences: any[] = [];
  let teamId = 1;
  let conferenceId = 1;

  const makeTeam = (teamName: string, prestige: number, conferenceName: string | null, confGames: number) => {
    const meta = teamsData.teams[teamName];
    const team = {
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
    const confTeams: any[] = [];
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
    const confTeams: any[] = [];
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

const createLeague = async (teamName: string, year: string) => {
  const { teams, conferences } = await buildTeamsAndConferences(year);
  const userTeam = teams.find(team => team.name === teamName) ?? teams[0];

  const schedule = Array.from({ length: 14 }, (_, index) => ({
    weekPlayed: index + 1,
    opponent: null,
    result: '',
    score: '',
    spread: '',
    moneyline: '',
    id: '',
  }));

  const info = {
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
    schedule,
    pending_rivalries: [],
  };

  saveLeague(league);
  localStorage.setItem('user_id', crypto.randomUUID());
  return league;
};

export const idbService = {
  getHome: async <T>(year?: string): Promise<T> => {
    const years = await getYearsList();
    const selectedYear = year || years[0] || null;
    const preview = selectedYear ? await buildPreviewData(selectedYear) : null;
    const league = loadLeague();

    return {
      info: league?.info ?? null,
      years,
      preview,
      selected_year: selectedYear,
    } as T;
  },

  getNonCon: async <T>(): Promise<T> => {
    const league = loadLeague();
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
    } as T;
  },

  get: async <T>(endpoint: string, params?: Record<string, any>): Promise<T> => {
    if (endpoint.startsWith('/api/noncon')) {
      if (params?.team && params?.year) {
        const league = await createLeague(params.team, params.year);
        const team = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
        return {
          info: league.info,
          team,
          schedule: league.schedule,
          pending_rivalries: league.pending_rivalries,
          conferences: league.conferences,
          user_id: localStorage.getItem('user_id'),
        } as T;
      }
      return idbService.getNonCon<T>();
    }

    throw new Error(`Endpoint not implemented in frontend2: ${endpoint}`);
  },
};

export default idbService;
