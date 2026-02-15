import { openDb } from '../db';
import type { InfoRecord } from '../db/schema';

interface YearsIndex {
  years: string[];
}

const getUserId = (): string | null => {
  return localStorage.getItem('user_id');
};

const readBaseData = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const db = await openDb();
  const cached = await db.get('baseData', key);
  if (cached) {
    return cached.value as T;
  }

  const value = await fetcher();
  await db.put('baseData', { key, value });
  return value;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const getYearsList = async (): Promise<string[]> => {
  const index = await readBaseData<YearsIndex>('years:index', () =>
    fetchJson<YearsIndex>('/data/years/index.json')
  );
  return index.years;
};

const getTeamsData = async (): Promise<Record<string, any>> => {
  const data = await readBaseData<{ teams: Record<string, any> }>('teams', () =>
    fetchJson<{ teams: Record<string, any> }>('/data/teams.json')
  );
  return data.teams;
};

const getConferencesData = async (): Promise<Record<string, string>> => {
  return readBaseData<Record<string, string>>('conferences', () =>
    fetchJson<Record<string, string>>('/data/conferences.json')
  );
};

const getYearData = async (year: string): Promise<any> => {
  return readBaseData<any>(`years:${year}`, () =>
    fetchJson<any>(`/data/years/${year}.json`)
  );
};

const buildPreviewData = async (year: string) => {
  const [yearData, teamsData, conferencesData] = await Promise.all([
    getYearData(year),
    getTeamsData(),
    getConferencesData(),
  ]);

  const addTeamMetadata = (teamName: string, prestige: number) => {
    const meta = teamsData[teamName];
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

const serializeInfo = async (info: InfoRecord | null) => {
  if (!info) return null;
  const db = await openDb();
  const team = info.team_id ? await db.get('teams', info.team_id) : null;

  return {
    ...info,
    team: team ? team.name : null,
    colorPrimary: team ? team.colorPrimary : null,
    colorSecondary: team ? team.colorSecondary : null,
  };
};

export const idbService = {
  getHome: async <T>(year?: string): Promise<T> => {
    const userId = getUserId();
    const db = await openDb();
    const info = userId ? await db.get('info', userId) : null;

    const years = await getYearsList();
    const selectedYear = year || years[0] || null;
    const preview = selectedYear ? await buildPreviewData(selectedYear) : null;

    return {
      info: await serializeInfo(info),
      years,
      preview,
      selected_year: selectedYear,
    } as T;
  },
};

export default idbService;
