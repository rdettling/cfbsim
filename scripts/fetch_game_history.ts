/// <reference types="node" />
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FIRST_GAME_HISTORY_YEAR,
  GAME_HISTORY_SOURCE,
} from '../src/domain/historicalGames';
import {
  emptyRawGameHistoryManifest,
  GAME_HISTORY_API_ENDPOINT,
  GAME_HISTORY_RANKINGS_API_ENDPOINT,
  type RawGameHistoryManifest,
  validateRawGameHistoryManifest,
} from './game_history_pipeline';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const RESULTS_DIRECTORY = join(ROOT, 'public', 'data', 'season-results');
const YEARS_INDEX_PATH = join(ROOT, 'public', 'data', 'years', 'index.json');
export const RAW_GAME_HISTORY_DIRECTORY = join(
  ROOT,
  '.artifacts',
  'game-history',
  'raw',
);
const MAX_API_ATTEMPTS = 4;

export type FetchGameHistoryOptions = {
  year: number | null;
  refresh: boolean;
};

type FetchSeasonResult = {
  year: number;
  skipped: boolean;
  regularRecords: number;
  postseasonRecords: number;
  rankingsRecords: number;
};

const readJson = async <T,>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

const isMissingFile = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';

export const parseFetchGameHistoryArgs = (
  args: string[],
): FetchGameHistoryOptions => {
  let year: number | null = null;
  let refresh = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--refresh') {
      refresh = true;
      continue;
    }
    if (argument === '--year') {
      const rawYear = args[index + 1];
      if (rawYear === undefined || !/^\d{4}$/.test(rawYear)) {
        throw new Error('--year requires a four-digit year.');
      }
      year = Number(rawYear);
      index += 1;
      continue;
    }
    throw new Error(`Unknown fetch:game-history argument: ${argument}`);
  }
  if (year !== null && year < FIRST_GAME_HISTORY_YEAR) {
    throw new Error(
      `Game-history years must be ${FIRST_GAME_HISTORY_YEAR} or later.`,
    );
  }
  return { year, refresh };
};

const getCompletedYears = async () => {
  const index = await readJson<{ years: string[] }>(YEARS_INDEX_PATH);
  const resultYears = new Set(
    (await readdir(RESULTS_DIRECTORY))
      .filter(name => /^\d{4}\.json$/.test(name))
      .map(name => Number(name.slice(0, 4))),
  );
  return index.years
    .map(Number)
    .filter(year =>
      Number.isInteger(year) &&
      year >= FIRST_GAME_HISTORY_YEAR &&
      resultYears.has(year),
    )
    .sort((left, right) => left - right);
};

const isPreRankingsManifest = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 3 &&
  (value as Record<string, unknown>).source === GAME_HISTORY_SOURCE &&
  (value as Record<string, unknown>).endpoint === GAME_HISTORY_API_ENDPOINT &&
  typeof (value as Record<string, unknown>).seasons === 'object' &&
  (value as Record<string, unknown>).seasons !== null;

const readManifest = async (rawDirectory: string, refresh: boolean) => {
  let value: unknown;
  try {
    value = await readJson<unknown>(join(rawDirectory, 'manifest.json'));
  } catch (error) {
    if (isMissingFile(error)) return emptyRawGameHistoryManifest();
    throw error;
  }
  if (refresh && isPreRankingsManifest(value)) {
    return emptyRawGameHistoryManifest();
  }
  return validateRawGameHistoryManifest(value);
};

const rawSnapshotExists = async (
  rawDirectory: string,
  manifest: RawGameHistoryManifest,
  year: number,
) => {
  const season = manifest.seasons[String(year)];
  if (!season) return false;
  try {
    await Promise.all([
      access(join(rawDirectory, season.regular.file)),
      access(join(rawDirectory, season.postseason.file)),
      access(join(rawDirectory, season.rankings.file)),
    ]);
    return true;
  } catch {
    return false;
  }
};

const fetchRawResponse = async ({
  apiKey,
  year,
  requestName,
  url,
  fetchImpl,
  sleep,
}: {
  apiKey: string;
  year: number;
  requestName: string;
  url: string;
  fetchImpl: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
}) => {
  let response: Response | null = null;
  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt += 1) {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok || response.status !== 429 || attempt === MAX_API_ATTEMPTS) {
      break;
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfter)
      ? Math.min(Math.max(retryAfter * 1_000, 1_000), 30_000)
      : attempt * 2_000;
    await sleep(delayMs);
  }
  if (!response?.ok) {
    throw new Error(
      `CFBD ${year} ${requestName} request failed with ${response?.status ?? 'no response'}.`,
    );
  }

  const body = await response.text();
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error(`CFBD ${year} ${requestName} response is not valid JSON.`);
  }
  if (!Array.isArray(value)) {
    throw new Error(`CFBD ${year} ${requestName} response is not an array.`);
  }
  return { body, records: value.length };
};

const sortedManifest = (
  manifest: RawGameHistoryManifest,
): RawGameHistoryManifest => ({
  ...manifest,
  seasons: Object.fromEntries(
    Object.entries(manifest.seasons).sort(
      ([left], [right]) => Number(left) - Number(right),
    ),
  ),
});

export const fetchRawGameHistorySeason = async ({
  apiKey,
  year,
  refresh,
  rawDirectory = RAW_GAME_HISTORY_DIRECTORY,
  fetchImpl = fetch,
  sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds)),
  now = () => new Date().toISOString(),
}: {
  apiKey: string;
  year: number;
  refresh: boolean;
  rawDirectory?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => string;
}): Promise<FetchSeasonResult> => {
  await mkdir(rawDirectory, { recursive: true });
  const manifest = await readManifest(rawDirectory, refresh);
  if (!refresh && await rawSnapshotExists(rawDirectory, manifest, year)) {
    const season = manifest.seasons[String(year)];
    return {
      year,
      skipped: true,
      regularRecords: season.regular.records,
      postseasonRecords: season.postseason.records,
      rankingsRecords: season.rankings.records,
    };
  }

  const gameUrl = (seasonType: 'regular' | 'postseason') => {
    const query = new URLSearchParams({
      year: String(year),
      seasonType,
    });
    return `${GAME_HISTORY_API_ENDPOINT}?${query}`;
  };
  const rankingsQuery = new URLSearchParams({ year: String(year) });
  const [regular, postseason, rankings] = await Promise.all([
    fetchRawResponse({
      apiKey,
      year,
      requestName: 'regular',
      url: gameUrl('regular'),
      fetchImpl,
      sleep,
    }),
    fetchRawResponse({
      apiKey,
      year,
      requestName: 'postseason',
      url: gameUrl('postseason'),
      fetchImpl,
      sleep,
    }),
    fetchRawResponse({
      apiKey,
      year,
      requestName: 'rankings',
      url: `${GAME_HISTORY_RANKINGS_API_ENDPOINT}?${rankingsQuery}`,
      fetchImpl,
      sleep,
    }),
  ]);

  const stagingDirectory = await mkdtemp(
    join(rawDirectory, `.staging-${year}-`),
  );
  const targetDirectory = join(rawDirectory, String(year));
  const backupDirectory = join(rawDirectory, `.backup-${year}`);
  const nextManifestPath = join(rawDirectory, '.manifest.next.json');
  const manifestPath = join(rawDirectory, 'manifest.json');
  const nextManifest = sortedManifest({
    ...manifest,
    seasons: {
      ...manifest.seasons,
      [String(year)]: {
        fetched_at: now(),
        regular: {
          file: `${year}/regular.json`,
          records: regular.records,
        },
        postseason: {
          file: `${year}/postseason.json`,
          records: postseason.records,
        },
        rankings: {
          file: `${year}/rankings.json`,
          records: rankings.records,
        },
      },
    },
  });

  await Promise.all([
    writeFile(join(stagingDirectory, 'regular.json'), regular.body),
    writeFile(join(stagingDirectory, 'postseason.json'), postseason.body),
    writeFile(join(stagingDirectory, 'rankings.json'), rankings.body),
    writeFile(nextManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`),
  ]);
  await rm(backupDirectory, { recursive: true, force: true });
  let hadPreviousSnapshot = false;
  try {
    await rename(targetDirectory, backupDirectory);
    hadPreviousSnapshot = true;
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  try {
    await rename(stagingDirectory, targetDirectory);
    await rename(nextManifestPath, manifestPath);
  } catch (error) {
    await rm(targetDirectory, { recursive: true, force: true });
    if (hadPreviousSnapshot) {
      await rename(backupDirectory, targetDirectory);
    }
    await rm(stagingDirectory, { recursive: true, force: true });
    await rm(nextManifestPath, { force: true });
    throw error;
  }
  await rm(backupDirectory, { recursive: true, force: true });

  return {
    year,
    skipped: false,
    regularRecords: regular.records,
    postseasonRecords: postseason.records,
    rankingsRecords: rankings.records,
  };
};

export const runFetchGameHistory = async ({
  options,
  apiKey,
  completedYears = getCompletedYears(),
}: {
  options: FetchGameHistoryOptions;
  apiKey: string;
  completedYears?: Promise<number[]>;
}) => {
  const availableYears = await completedYears;
  const years = options.year === null ? availableYears : [options.year];
  const unavailableYear = years.find(year => !availableYears.includes(year));
  if (unavailableYear !== undefined) {
    throw new Error(
      `Game-history year ${unavailableYear} is not a completed bundled season.`,
    );
  }
  const results: FetchSeasonResult[] = [];
  for (const year of years) {
    results.push(await fetchRawGameHistorySeason({
      apiKey,
      year,
      refresh: options.refresh,
    }));
  }
  return results;
};

const main = async () => {
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) {
    throw new Error('CFBD_API_KEY is required. Add it to the local .env file.');
  }
  const results = await runFetchGameHistory({
    options: parseFetchGameHistoryArgs(process.argv.slice(2)),
    apiKey,
  });
  for (const result of results) {
    console.log(
      `${result.skipped ? 'Skipped' : 'Fetched'} ${result.year}: ` +
      `${result.regularRecords} regular, ` +
      `${result.postseasonRecords} postseason, ` +
      `${result.rankingsRecords} rankings records.`,
    );
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
