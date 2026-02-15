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
