/// <reference types="node" />
import {
  mkdir,
  mkdtemp,
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
import { buildBettingOddsData } from './generate_betting_odds';
import {
  buildHistoryData,
  buildSeasonIndexData,
  DATA_ROOT,
  readJson,
} from './generate_history';

export type DataBuildOutputs = {
  seasonIndex: SeasonIndexData;
  history: HistoryData;
  bettingOdds: BettingOddsData;
  historicalIndex: HistoricalGamesIndex;
  historicalByTeam: Map<string, HistoricalGamesForTeam>;
};

export const prettyJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const compactJson = (value: unknown) => `${JSON.stringify(value)}\n`;

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

const writeAtomicFile = async (path: string, contents: string) => {
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

export const writeDataOutputs = async (
  outputs: DataBuildOutputs,
  dataRoot = DATA_ROOT,
) => {
  const historicalDirectory = join(dataRoot, 'historical-games');
  const byTeamDirectory = join(historicalDirectory, 'by-team');
  await mkdir(historicalDirectory, { recursive: true });
  const stagedByTeam = await mkdtemp(join(historicalDirectory, '.by-team-'));
  try {
    await Promise.all([...outputs.historicalByTeam].map(([fileName, value]) =>
      writeFile(join(stagedByTeam, fileName), compactJson(value))));

    await Promise.all([
      writeAtomicFile(join(dataRoot, 'seasons', 'index.json'), prettyJson(outputs.seasonIndex)),
      writeAtomicFile(join(dataRoot, 'history.json'), prettyJson(outputs.history)),
      writeAtomicFile(join(dataRoot, 'betting_odds.json'), prettyJson(outputs.bettingOdds)),
      writeAtomicFile(join(historicalDirectory, 'index.json'), prettyJson(outputs.historicalIndex)),
    ]);
    await replaceDirectory(stagedByTeam, byTeamDirectory);
  } catch (error) {
    await rm(stagedByTeam, { recursive: true, force: true });
    throw error;
  }
};

export const runDataBuild = async (dataRoot = DATA_ROOT) => {
  const outputs = await buildDataOutputs(dataRoot);
  await writeDataOutputs(outputs, dataRoot);
  return outputs;
};

const main = async () => {
  const outputs = await runDataBuild();
  console.log(
    `Built season index, history, ${Object.keys(outputs.bettingOdds.odds).length} odds rows, ` +
    `${outputs.historicalIndex.years.length} historical seasons, and ` +
    `${outputs.historicalByTeam.size} team projections.`,
  );
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  await main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
