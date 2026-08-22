/// <reference types="node" />
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHistoricalGamesByTeam,
  GAME_HISTORY_SOURCE,
  getHistoricalTeamGamesFileName,
  validateHistoricalGamesForTeam,
  validateHistoricalGamesIndex,
  validateHistoricalGamesSeason,
} from '../src/domain/historicalGames';
import {
  validateHistoryData,
  validateSeasonIndexData,
  validateTeamsData,
} from '../src/domain/baseDataValidation';
import type {
  BettingOddsData,
  HistoricalGamesForTeam,
  HistoricalGamesIndex,
  HistoricalGamesSeason,
  HistoryData,
  SeasonIndexData,
} from '../src/types/baseData';
import { buildBettingOddsData } from './build_betting_odds';
import {
  buildHistoryData,
  buildSeasonIndexData,
} from './build_history';
import {
  compactJson,
  DATA_ROOT,
  prettyJson,
  readJson,
} from './data_files';

export type DataBuildOutputs = {
  seasonIndex: SeasonIndexData;
  history: HistoryData;
  bettingOdds: BettingOddsData;
  historicalIndex: HistoricalGamesIndex;
  historicalByTeam: Map<string, HistoricalGamesForTeam>;
};

export type DataScope = 'all' | 'seasons' | 'odds' | 'historical-games';
export type ScopedDataBuildOutputs = Partial<DataBuildOutputs>;

const DATA_SCOPES = new Set<DataScope>([
  'seasons',
  'odds',
  'historical-games',
]);

export const parseDataScope = (arguments_: string[]): DataScope => {
  if (arguments_.length === 0) return 'all';
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== '--scope' ||
    !DATA_SCOPES.has(arguments_[1] as DataScope)
  ) {
    throw new Error(
      'Expected no arguments or exactly --scope seasons|odds|historical-games.',
    );
  }
  return arguments_[1] as DataScope;
};

const getHistoricalSeasons = async (dataRoot: string) => {
  const directory = join(dataRoot, 'historical-games');
  const years = (await readdir(directory))
    .filter(name => /^\d{4}\.json$/.test(name))
    .map(name => Number(name.slice(0, 4)))
    .sort((left, right) => left - right);
  return Promise.all(years.map(async year =>
    validateHistoricalGamesSeason(
      await readJson<unknown>(join(directory, `${year}.json`)),
      year,
    )));
};

export const buildHistoricalGameProjectionData = (
  seasons: HistoricalGamesSeason[],
  supportedTeams: ReadonlySet<string>,
): Pick<DataBuildOutputs, 'historicalIndex' | 'historicalByTeam'> => {
  const years = seasons.map(season => season.year);
  const historicalIndex = validateHistoricalGamesIndex({
    source: GAME_HISTORY_SOURCE,
    years,
  });
  const availableYears = new Set(years);
  const historicalByTeam = new Map<string, HistoricalGamesForTeam>();
  for (const projection of buildHistoricalGamesByTeam(seasons, supportedTeams)) {
    const validated = validateHistoricalGamesForTeam(
      projection,
      projection.team,
      availableYears,
    );
    historicalByTeam.set(getHistoricalTeamGamesFileName(projection.team), validated);
  }
  return { historicalIndex, historicalByTeam };
};

export const buildHistoricalGameProjections = async (
  dataRoot = DATA_ROOT,
): Promise<Pick<DataBuildOutputs, 'historicalIndex' | 'historicalByTeam'>> => {
  const [teams, seasons] = await Promise.all([
    readJson<unknown>(join(dataRoot, 'teams.json')).then(value =>
      validateTeamsData(value, 'teams.json')),
    getHistoricalSeasons(dataRoot),
  ]);
  return buildHistoricalGameProjectionData(
    seasons,
    new Set(Object.keys(teams.teams)),
  );
};

export const buildDataOutputs = async (
  dataRoot = DATA_ROOT,
): Promise<DataBuildOutputs> => {
  const [seasonIndex, history, historical] = await Promise.all([
    buildSeasonIndexData(dataRoot).then(value =>
      validateSeasonIndexData(value, 'generated seasons/index.json')),
    buildHistoryData(dataRoot).then(value =>
      validateHistoryData(value, 'generated history.json')),
    buildHistoricalGameProjections(dataRoot),
  ]);
  const bettingOdds = buildBettingOddsData();
  return {
    seasonIndex,
    history,
    bettingOdds,
    ...historical,
  };
};

export const buildScopedDataOutputs = async (
  dataRoot = DATA_ROOT,
  scope: DataScope = 'all',
): Promise<ScopedDataBuildOutputs> => {
  if (scope === 'all') return buildDataOutputs(dataRoot);
  if (scope === 'seasons') {
    const [seasonIndex, history] = await Promise.all([
      buildSeasonIndexData(dataRoot).then(value =>
        validateSeasonIndexData(value, 'generated seasons/index.json')),
      buildHistoryData(dataRoot).then(value =>
        validateHistoryData(value, 'generated history.json')),
    ]);
    return { seasonIndex, history };
  }
  if (scope === 'odds') return { bettingOdds: buildBettingOddsData() };
  return buildHistoricalGameProjections(dataRoot);
};

const writeAtomicFile = async (path: string, contents: string) => {
  try {
    if ((await readFile(path)).equals(Buffer.from(contents))) return;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  const temporary = join(
    dirname(path),
    `.${path.split('/').at(-1)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, contents);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};

const directoryMatches = async (
  directory: string,
  files: ReadonlyMap<string, HistoricalGamesForTeam>,
) => {
  let actualFiles: string[];
  try {
    actualFiles = (await readdir(directory)).sort();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
  const expectedFiles = [...files.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) return false;
  return (await Promise.all(expectedFiles.map(async fileName =>
    (await readFile(join(directory, fileName))).equals(
      Buffer.from(compactJson(files.get(fileName)!)),
    )))).every(Boolean);
};

const replaceDirectory = async (staging: string, target: string) => {
  const backup = `${target}.backup`;
  await rm(backup, { recursive: true, force: true });
  let hadTarget = true;
  try {
    await rename(target, backup);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      hadTarget = false;
    } else {
      throw error;
    }
  }
  try {
    await rename(staging, target);
  } catch (error) {
    if (hadTarget) await rename(backup, target);
    throw error;
  }
  if (hadTarget) await rm(backup, { recursive: true, force: true });
};

export const writeDataOutputs = async (
  outputs: ScopedDataBuildOutputs,
  dataRoot = DATA_ROOT,
) => {
  const historicalDirectory = join(dataRoot, 'historical-games');
  const byTeamDirectory = join(historicalDirectory, 'by-team');
  await Promise.all([
    outputs.seasonIndex
      ? writeAtomicFile(join(dataRoot, 'seasons', 'index.json'), prettyJson(outputs.seasonIndex))
      : undefined,
    outputs.history
      ? writeAtomicFile(join(dataRoot, 'history.json'), prettyJson(outputs.history))
      : undefined,
    outputs.bettingOdds
      ? writeAtomicFile(join(dataRoot, 'betting_odds.json'), prettyJson(outputs.bettingOdds))
      : undefined,
    outputs.historicalIndex
      ? writeAtomicFile(join(historicalDirectory, 'index.json'), prettyJson(outputs.historicalIndex))
      : undefined,
  ]);

  if (outputs.historicalByTeam) {
    await mkdir(historicalDirectory, { recursive: true });
    if (await directoryMatches(byTeamDirectory, outputs.historicalByTeam)) return;
    const stagedByTeam = await mkdtemp(join(historicalDirectory, '.by-team-'));
    try {
      await Promise.all([...outputs.historicalByTeam].map(([fileName, value]) =>
        writeFile(join(stagedByTeam, fileName), compactJson(value))));
      await replaceDirectory(stagedByTeam, byTeamDirectory);
    } catch (error) {
      await rm(stagedByTeam, { recursive: true, force: true });
      throw error;
    }
  }
};

export const runDataBuild = async (
  dataRoot = DATA_ROOT,
  scope: DataScope = 'all',
) => {
  const outputs = await buildScopedDataOutputs(dataRoot, scope);
  await writeDataOutputs(outputs, dataRoot);
  return outputs;
};

const main = async () => {
  const scope = parseDataScope(process.argv.slice(2));
  await runDataBuild(DATA_ROOT, scope);
  console.log(`Built ${scope === 'all' ? 'all static projections' : scope}.`);
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  await main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
