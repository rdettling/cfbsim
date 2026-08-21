import { getDb } from './db';
import { validateSeasonData } from '../domain/seasonDataValidation';
import {
  validateBettingOddsData,
  validateConferencesData,
  validateHistoryData,
  validateNamesData,
  validatePrestigeConfig,
  validateSeasonIndexData,
  validateStatesData,
  validateTeamsData,
} from '../domain/baseDataValidation';
import type {
  BettingOddsData,
  ConferencesData,
  HistoricalGamesForTeam,
  HistoricalGamesIndex,
  HistoricalGamesSeason,
  HistoryData,
  NamesData,
  PrestigeConfig,
  SeasonIndexData,
  SeasonData,
  StatesData,
  TeamsData,
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

export const STATIC_DATA_VERSION = 15;
const STATIC_DATA_VERSION_KEY = 'static_data_version';
const MUTABLE_BASE_DATA_KEYS = new Set(['history']);

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const getValidatedBaseData = async <T,>(
  key: string,
  url: string,
  validate: (value: unknown) => T,
): Promise<T> => {
  const db = await getDb();
  const cached = await db.get('baseData', key);
  if (cached) return validate(cached.value);

  const value = validate(await fetchJson<unknown>(url));
  await db.put('baseData', { key, value });
  return value;
};

export const getSeasonIndex = () =>
  getValidatedBaseData<SeasonIndexData>(
    'seasons:index',
    '/data/seasons/index.json',
    value => validateSeasonIndexData(value, '/data/seasons/index.json'),
  );
export const getTeamsData = () =>
  getValidatedBaseData<TeamsData>('teams', '/data/teams.json', value =>
    validateTeamsData(value, '/data/teams.json'));
export const getConferencesData = () =>
  getValidatedBaseData<ConferencesData>(
    'conferences',
    '/data/conferences.json',
    value => validateConferencesData(value, '/data/conferences.json'),
  );
export const getSeasonData = async (year: string): Promise<SeasonData> =>
  getValidatedBaseData<SeasonData>(
    `seasons:${year}`,
    `/data/seasons/${year}.json`,
    value => validateSeasonData(value, `Season ${year}`, Number(year)),
  );
export const getHistoryData = () =>
  getValidatedBaseData<HistoryData>('history', '/data/history.json', value =>
    validateHistoryData(value, '/data/history.json'));

export const getHistoricalGamesIndex = (): Promise<HistoricalGamesIndex> =>
  getValidatedBaseData(
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
  return getValidatedBaseData(
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
  return getValidatedBaseData(
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
  const validated = validateHistoryData(value, 'saved history');
  await db.put('baseData', { key: 'history', value: validated });
  return validated;
};
export const getPrestigeConfig = () =>
  getValidatedBaseData<PrestigeConfig>(
    'prestige_config',
    '/data/prestige_config.json',
    value => validatePrestigeConfig(value, '/data/prestige_config.json'),
  );
export const getRivalriesData = async (): Promise<{ rivalries: RivalryDefinition[] }> => {
  const teams = await getTeamsData();
  const knownTeams = new Set(Object.keys(teams.teams));
  const value = await getValidatedBaseData<unknown>(
    'rivalries',
    '/data/rivalries.json',
    value => {
      normalizeRivalriesData(value, knownTeams);
      return value;
    },
  );
  return normalizeRivalriesData(value, knownTeams);
};
export const getNamesData = () =>
  getValidatedBaseData<NamesData>(
    'names',
    '/data/names.json',
    value => validateNamesData(value, '/data/names.json'),
  );
export const getStatesData = () =>
  getValidatedBaseData<StatesData>('states', '/data/states.json', value =>
    validateStatesData(value, '/data/states.json'));
export const getBettingOddsData = () =>
  getValidatedBaseData<BettingOddsData>(
    'betting_odds',
    '/data/betting_odds.json',
    value => validateBettingOddsData(value, '/data/betting_odds.json'),
  );

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
