import { getDb } from './db';

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const getBaseData = async <T,>(key: string, url: string): Promise<T> => {
  const db = await getDb();
  const cached = await db.get('baseData', key);
  if (cached) return cached.value as T;

  const value = await fetchJson<T>(url);
  await db.put('baseData', { key, value });
  return value;
};

export const getYearsIndex = () =>
  getBaseData<{ years: string[] }>('years:index', '/data/years/index.json');
export const getTeamsData = () => getBaseData<any>('teams', '/data/teams.json');
export const getConferencesData = () =>
  getBaseData<any>('conferences', '/data/conferences.json');
export const getYearData = (year: string) =>
  getBaseData<any>(`years:${year}`, `/data/years/${year}.json`);
export const getRatingsData = (year: string) =>
  getBaseData<any>(`ratings:${year}`, `/data/ratings/ratings_${year}.json`);
export const getHistoryData = () =>
  getBaseData<any>('history', '/data/history.json');
export const getRivalriesData = () =>
  getBaseData<{ rivalries: [string, string, number | null, string | null][] }>(
    'rivalries',
    '/data/rivalries.json'
  );
export const getHeadlinesData = () =>
  getBaseData<Record<string, string[]>>('headlines', '/data/headlines.json');
export const getNamesData = () =>
  getBaseData<Record<string, { first: Array<{ name: string; weight: number }>; last: Array<{ name: string; weight: number }> }>>(
    'names',
    '/data/names.json'
  );
export const getStatesData = () =>
  getBaseData<Record<string, number>>('states', '/data/states.json');
export const getBettingOddsData = () =>
  getBaseData<{
    generated_at?: string;
    max_diff?: number;
    odds: Record<
      string,
      {
        favSpread: string;
        udSpread: string;
        favWinProb: number;
        udWinProb: number;
        favMoneyline: string;
        udMoneyline: string;
      }
    >;
  }>('betting_odds', '/data/betting_odds.json');
