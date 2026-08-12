import { getDb } from './db';
import { validateYearData } from '../domain/yearDataValidation';
import type {
  ConferencesData,
  HistoricalGamesForTeam,
  HistoricalGamesIndex,
  HistoricalGamesSeason,
  HistoryData,
  TeamsData,
  YearData,
} from '../types/baseData';
import type { RivalryDefinition } from '../types/domain';
import { normalizeRivalriesData } from '../domain/rivalryData';
import {
  FIRST_GAME_HISTORY_YEAR,
  getHistoricalTeamGamesFileName,
  validateHistoricalGamesIndex,
  validateHistoricalGamesSeason,
  validateHistoricalGamesForTeam,
} from '../domain/historicalGames';

export const STATIC_DATA_VERSION = 7;
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

const getValidatedHistoricalData = async <T,>(
  key: string,
  url: string,
  validate: (value: unknown) => T,
) => {
  const db = await getDb();
  const cached = await db.get('baseData', key);
  if (cached) return validate(cached.value);

  const value = validate(await fetchJson<unknown>(url));
  await db.put('baseData', { key, value });
  return value;
};

export const getHistoricalGamesIndex = (): Promise<HistoricalGamesIndex> =>
  getValidatedHistoricalData(
    'historical-games:index',
    '/data/historical-games/index.json',
    validateHistoricalGamesIndex,
  );

export const getHistoricalGamesSeason = async (
  year: number,
): Promise<HistoricalGamesSeason> => {
  if (!Number.isInteger(year) || year < FIRST_GAME_HISTORY_YEAR) {
    throw new Error(`Historical game season ${year} is invalid.`);
  }
  const index = await getHistoricalGamesIndex();
  if (!index.years.includes(year)) {
    throw new Error(`Historical game season ${year} is not available.`);
  }
  return getValidatedHistoricalData(
    `historical-games:${year}`,
    `/data/historical-games/${year}.json`,
    value => validateHistoricalGamesSeason(value, year),
  );
};

export const getHistoricalGamesForTeam = async (
  teamName: string,
): Promise<HistoricalGamesForTeam> => {
  const fileName = getHistoricalTeamGamesFileName(teamName);
  const index = await getHistoricalGamesIndex();
  return getValidatedHistoricalData(
    `historical-games:team:${teamName}`,
    `/data/historical-games/by-team/${encodeURIComponent(fileName)}`,
    value => validateHistoricalGamesForTeam(
      value,
      teamName,
      new Set(index.years),
    ),
  );
};
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
