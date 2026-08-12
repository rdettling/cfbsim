import {
  FIRST_GAME_HISTORY_YEAR,
  GAME_HISTORY_SOURCE,
} from '../src/domain/historicalGames';

export const GAME_HISTORY_API_ENDPOINT =
  'https://api.collegefootballdata.com/games' as const;
export const GAME_HISTORY_RANKINGS_API_ENDPOINT =
  'https://api.collegefootballdata.com/rankings' as const;

export type RawSeasonType = 'regular' | 'postseason';

export type RawGameHistoryFile = {
  file: string;
  records: number;
};

export type RawGameHistorySeason = {
  fetched_at: string;
  regular: RawGameHistoryFile;
  postseason: RawGameHistoryFile;
  rankings: RawGameHistoryFile;
};

export type RawGameHistoryManifest = {
  source: typeof GAME_HISTORY_SOURCE;
  endpoints: {
    games: typeof GAME_HISTORY_API_ENDPOINT;
    rankings: typeof GAME_HISTORY_RANKINGS_API_ENDPOINT;
  };
  seasons: Record<string, RawGameHistorySeason>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const validRawFile = (value: unknown): value is RawGameHistoryFile =>
  isRecord(value) &&
  hasExactKeys(value, ['file', 'records']) &&
  typeof value.file === 'string' &&
  /^\d{4}\/(regular|postseason|rankings)\.json$/.test(value.file) &&
  Number.isInteger(value.records) &&
  Number(value.records) >= 0;

export const validateRawGameHistoryManifest = (
  value: unknown,
): RawGameHistoryManifest => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['source', 'endpoints', 'seasons']) ||
    value.source !== GAME_HISTORY_SOURCE ||
    !isRecord(value.endpoints) ||
    !hasExactKeys(value.endpoints, ['games', 'rankings']) ||
    value.endpoints.games !== GAME_HISTORY_API_ENDPOINT ||
    value.endpoints.rankings !== GAME_HISTORY_RANKINGS_API_ENDPOINT ||
    !isRecord(value.seasons)
  ) {
    throw new Error('Raw game-history manifest does not match the current schema.');
  }

  for (const [year, season] of Object.entries(value.seasons)) {
    if (
      !/^\d{4}$/.test(year) ||
      Number(year) < FIRST_GAME_HISTORY_YEAR ||
      !isRecord(season) ||
      !hasExactKeys(
        season,
        ['fetched_at', 'regular', 'postseason', 'rankings'],
      ) ||
      typeof season.fetched_at !== 'string' ||
      Number.isNaN(Date.parse(season.fetched_at)) ||
      !validRawFile(season.regular) ||
      !validRawFile(season.postseason) ||
      !validRawFile(season.rankings) ||
      season.regular.file !== `${year}/regular.json` ||
      season.postseason.file !== `${year}/postseason.json` ||
      season.rankings.file !== `${year}/rankings.json`
    ) {
      throw new Error(`Raw game-history manifest season ${year} is invalid.`);
    }
  }

  return value as unknown as RawGameHistoryManifest;
};

export const emptyRawGameHistoryManifest = (): RawGameHistoryManifest => ({
  source: GAME_HISTORY_SOURCE,
  endpoints: {
    games: GAME_HISTORY_API_ENDPOINT,
    rankings: GAME_HISTORY_RANKINGS_API_ENDPOINT,
  },
  seasons: {},
});
