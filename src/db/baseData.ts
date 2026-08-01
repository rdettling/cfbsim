import { getDb } from './db';
import { validateYearData } from '../domain/yearDataValidation';
import type {
  ConferencesData,
  HistoryData,
  TeamsData,
  YearData,
} from '../types/baseData';
import type { RivalryDefinition } from '../types/domain';
import { normalizeRivalriesData } from '../domain/rivalryData';

export const STATIC_DATA_VERSION = 5;
const STATIC_DATA_VERSION_KEY = 'static_data_version';
const MUTABLE_BASE_DATA_KEYS = new Set(['history']);

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
export const getTeamsData = () =>
  getBaseData<TeamsData>('teams', '/data/teams.json');
export const getConferencesData = () =>
  getBaseData<ConferencesData>('conferences', '/data/conferences.json');
export const getYearData = async (year: string): Promise<YearData> =>
  validateYearData(
    await getBaseData<unknown>(`years:${year}`, `/data/years/${year}.json`),
    `Year ${year}`,
  );
export const getHistoryData = () =>
  getBaseData<HistoryData>('history', '/data/history.json');
export const setHistoryData = async (value: HistoryData) => {
  const db = await getDb();
  await db.put('baseData', { key: 'history', value });
  return value;
};
export const getPrestigeConfig = () =>
  getBaseData<Record<string, number>>('prestige_config', '/data/prestige_config.json');
export const getRivalriesData = async (): Promise<{ rivalries: RivalryDefinition[] }> => {
  const [value, teams] = await Promise.all([
    getBaseData<unknown>('rivalries', '/data/rivalries.json'),
    getTeamsData(),
  ]);
  return normalizeRivalriesData(value, new Set(Object.keys(teams.teams)));
};
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

export const initializeBaseDataCache = async () => {
  const db = await getDb();
  const tx = db.transaction('baseData', 'readwrite');
  const store = tx.store;
  const versionRecord = await store.get(STATIC_DATA_VERSION_KEY);
  if (versionRecord?.value === STATIC_DATA_VERSION) {
    await tx.done;
    return;
  }

  let cursor = await store.openCursor();
  while (cursor) {
    if (!MUTABLE_BASE_DATA_KEYS.has(cursor.key)) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await store.put({
    key: STATIC_DATA_VERSION_KEY,
    value: STATIC_DATA_VERSION,
  });
  await tx.done;
};

export const clearBaseDataCache = async () => {
  const db = await getDb();
  const tx = db.transaction('baseData', 'readwrite');
  await tx.store.clear();
  await tx.store.put({
    key: STATIC_DATA_VERSION_KEY,
    value: STATIC_DATA_VERSION,
  });
  await tx.done;
};
