/// <reference types="node" />
import {
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateSeasonData } from '../src/domain/seasonDataValidation';
import { canonicalCfbdTeamName } from './cfbd_team_names';
import type { SeasonData, SeasonIndexData } from '../src/types/baseData';
import { fetchCfbdArray } from './cfbd';
import {
  buildSeasonResults,
  CFBD_RANKINGS_ENDPOINT,
  CFBD_RECORDS_ENDPOINT,
  CFBD_SP_ENDPOINT,
  CFBD_SRS_ENDPOINT,
} from './season_results_pipeline';

const SP_FALLBACK_YEAR = 2020;
const COVID_CANCELED_TEAMS = ['Connecticut', 'Old Dominion'] as const;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
export const DATA_ROOT = join(ROOT, 'public', 'data');

export type FetchSeasonResultsOptions = {
  selection: { type: 'year'; year: number } | { type: 'all' };
  mode: 'create' | 'refresh' | 'check';
};

export type SeasonResultsAudit = {
  year: number;
  teams: number;
  apAvailable: number;
  ratingTeams: number;
  ratingSource: 'SRS' | 'SP+';
};

const readJson = async <T,>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export const addKnownMissingRecords = (records: unknown[], year: number) => {
  if (year !== SP_FALLBACK_YEAR) return records;
  const present = new Set(records.flatMap(record => {
    if (
      typeof record !== 'object' ||
      record === null ||
      !('team' in record) ||
      typeof record.team !== 'string'
    ) return [];
    return [canonicalCfbdTeamName(record.team)];
  }));
  return [
    ...records,
    ...COVID_CANCELED_TEAMS
      .filter(team => !present.has(team))
      .map(team => ({
        year,
        team,
        classification: 'fbs',
        total: { games: 0, wins: 0, losses: 0, ties: 0 },
      })),
  ];
};

export const parseFetchSeasonResultsArgs = (
  args: string[],
): FetchSeasonResultsOptions => {
  let year: number | null = null;
  let all = false;
  let refresh = false;
  let check = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--year') {
      const rawYear = args[index + 1];
      if (rawYear === undefined || !/^\d{4}$/.test(rawYear)) {
        throw new Error('--year requires a four-digit year.');
      }
      year = Number(rawYear);
      index += 1;
    } else if (argument === '--all') {
      all = true;
    } else if (argument === '--refresh') {
      refresh = true;
    } else if (argument === '--check') {
      check = true;
    } else {
      throw new Error(`Unknown fetch:season-results argument: ${argument}`);
    }
  }
  if ((year === null) === !all) {
    throw new Error('Choose exactly one of --year YYYY or --all.');
  }
  if (refresh && check) throw new Error('--refresh and --check cannot be combined.');
  if (all && !refresh && !check) {
    throw new Error('--all requires either --refresh or --check.');
  }
  return {
    selection: all ? { type: 'all' } : { type: 'year', year: year! },
    mode: refresh ? 'refresh' : check ? 'check' : 'create',
  };
};

const getSeasonYears = async (dataRoot: string) =>
  (await readdir(join(dataRoot, 'seasons')))
    .filter(name => /^\d{4}\.json$/.test(name))
    .map(name => Number(name.slice(0, 4)))
    .sort((left, right) => left - right);

const readSeason = async (dataRoot: string, year: number) =>
  validateSeasonData(
    await readJson<unknown>(join(dataRoot, 'seasons', `${year}.json`)),
    `seasons/${year}.json`,
    year,
  );

const seasonIndex = (years: number[]): SeasonIndexData => ({
  years: [...years]
    .sort((left, right) => right - left)
    .map(String),
});

const endpoint = (base: string, parameters: Record<string, string>) =>
  `${base}?${new URLSearchParams(parameters)}`;

export const fetchSeasonResultsCandidate = async ({
  apiKey,
  dataRoot = DATA_ROOT,
  fetchImpl = fetch,
  sleep,
  year,
}: {
  apiKey: string;
  dataRoot?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  year: number;
}): Promise<{
  data: SeasonData;
  serialized: string;
  audit: SeasonResultsAudit;
}> => {
  const seasonData = await readSeason(dataRoot, year);
  const request = (requestName: string, url: string) =>
    fetchCfbdArray({ apiKey, fetchImpl, requestName, sleep, url, year });
  const ratingSource = year === SP_FALLBACK_YEAR ? 'SP+' : 'SRS';
  const ratingsEndpoint = year === SP_FALLBACK_YEAR
    ? CFBD_SP_ENDPOINT
    : CFBD_SRS_ENDPOINT;
  const [rankings, powerRatings, records] = await Promise.all([
    request('rankings', endpoint(CFBD_RANKINGS_ENDPOINT, {
      year: String(year),
      seasonType: 'postseason',
    })),
    request(ratingSource, endpoint(ratingsEndpoint, { year: String(year) })),
    request('records', endpoint(CFBD_RECORDS_ENDPOINT, { year: String(year) })),
  ]);
  const result = buildSeasonResults({
    powerRatings: powerRatings.value,
    rankings: rankings.value,
    ratingSource,
    records: addKnownMissingRecords(records.value, year),
    year,
    yearData: seasonData,
  });
  const data = validateSeasonData(
    { ...seasonData, results: result.results },
    `Generated season ${year}`,
    year,
  );
  return {
    data,
    serialized: serialize(data),
    audit: {
      year,
      teams: Object.keys(result.results).length,
      apAvailable: result.apAvailable,
      ratingTeams: Object.keys(result.results).length,
      ratingSource,
    },
  };
};

const writeSingleAtomically = async (
  seasonsDirectory: string,
  year: number,
  contents: string,
) => {
  const stagedFile = join(
    seasonsDirectory,
    `.${year}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(stagedFile, contents);
    await rename(stagedFile, join(seasonsDirectory, `${year}.json`));
  } finally {
    await rm(stagedFile, { force: true });
  }
};

const replaceDirectory = async (staging: string, target: string) => {
  const backup = `${target}.backup`;
  await rm(backup, { recursive: true, force: true });
  await rename(target, backup);
  try {
    await rename(staging, target);
  } catch (error) {
    await rename(backup, target);
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
};

export const runFetchSeasonResults = async ({
  apiKey,
  dataRoot = DATA_ROOT,
  fetchImpl = fetch,
  options,
  sleep,
}: {
  apiKey: string;
  dataRoot?: string;
  fetchImpl?: typeof fetch;
  options: FetchSeasonResultsOptions;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<SeasonResultsAudit[]> => {
  const seasonsDirectory = join(dataRoot, 'seasons');
  const allYears = await getSeasonYears(dataRoot);
  const seasons = await Promise.all(allYears.map(year => readSeason(dataRoot, year)));
  const requestedYears = options.selection.type === 'all'
    ? seasons.filter(season => season.results !== null).map(season => season.year)
    : [options.selection.year];
  const unsupported = requestedYears.find(year => !allYears.includes(year));
  if (unsupported !== undefined || !requestedYears.length) {
    throw new Error(
      unsupported !== undefined
        ? `The ${unsupported} season is not supported.`
        : 'No completed seasons are available.',
    );
  }
  if (options.mode === 'create') {
    const season = seasons.find(entry => entry.year === requestedYears[0])!;
    if (season.results !== null) {
      throw new Error(
        `Season ${season.year} already has results; use --check or --refresh.`,
      );
    }
  }

  const candidates: Awaited<ReturnType<typeof fetchSeasonResultsCandidate>>[] = [];
  for (const year of requestedYears) {
    candidates.push(await fetchSeasonResultsCandidate({
      apiKey,
      dataRoot,
      fetchImpl,
      sleep,
      year,
    }));
  }

  if (options.mode === 'check') {
    for (const candidate of candidates) {
      const current = await readFile(
        join(seasonsDirectory, `${candidate.data.year}.json`),
        'utf8',
      );
      if (current !== candidate.serialized) {
        throw new Error(
          `seasons/${candidate.data.year}.json does not match CFBD.`,
        );
      }
    }
    const currentIndex = await readFile(join(seasonsDirectory, 'index.json'), 'utf8');
    if (currentIndex !== serialize(seasonIndex(allYears))) {
      throw new Error('seasons/index.json does not match season filenames.');
    }
  } else if (options.selection.type === 'all') {
    const staging = await mkdtemp(join(dataRoot, '.seasons-staging-'));
    const candidatesByYear = new Map(
      candidates.map(candidate => [candidate.data.year, candidate]),
    );
    try {
      await Promise.all(seasons.map(season =>
        writeFile(
          join(staging, `${season.year}.json`),
          candidatesByYear.get(season.year)?.serialized ?? serialize(season),
        ),
      ));
      await writeFile(
        join(staging, 'index.json'),
        serialize(seasonIndex(allYears)),
      );
      await replaceDirectory(staging, seasonsDirectory);
    } catch (error) {
      await rm(staging, { recursive: true, force: true });
      throw error;
    }
  } else {
    const candidate = candidates[0];
    await writeSingleAtomically(
      seasonsDirectory,
      candidate.data.year,
      candidate.serialized,
    );
  }
  return candidates.map(candidate => candidate.audit);
};

const main = async () => {
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) {
    throw new Error('CFBD_API_KEY is required. Add it to the local .env file.');
  }
  const options = parseFetchSeasonResultsArgs(process.argv.slice(2));
  const audits = await runFetchSeasonResults({ apiKey, options });
  for (const audit of audits) {
    const path = `public/data/seasons/${audit.year}.json`;
    console.log(
      `${options.mode === 'check' ? 'Checked' : 'Generated'} ${audit.year}: ` +
      `${audit.teams} teams, ${audit.apAvailable} AP poll entries, ` +
      `${audit.ratingTeams} ${audit.ratingSource} teams; ` +
      `${options.mode === 'check' ? 'matches' : 'wrote'} ${path}.`,
    );
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
