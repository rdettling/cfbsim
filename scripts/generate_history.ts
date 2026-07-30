/// <reference types="node" />
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateYearData } from '../src/domain/yearDataValidation';
import type {
  HistoryData,
  SeasonResultsData,
  YearData,
} from '../src/types/baseData';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = join(SCRIPT_DIR, '..', 'public', 'data');

export const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf-8')) as T;

const getPrestige = (teamName: string, yearData: YearData) => {
  for (const conference of Object.values(yearData.conferences)) {
    if (teamName in conference.teams) return conference.teams[teamName];
  }
  return yearData.independents[teamName];
};

export const buildHistoryData = async (
  dataRoot = DATA_ROOT,
): Promise<HistoryData> => {
  const index = await readJson<{ years: string[] }>(
    join(dataRoot, 'years', 'index.json'),
  );
  const indexedYears = new Set(index.years);
  const resultYears = (await readdir(join(dataRoot, 'season-results')))
    .filter(name => /^\d{4}\.json$/.test(name))
    .map(name => name.slice(0, 4))
    .sort((left, right) => Number(right) - Number(left));
  const unexpectedYears = resultYears.filter(year => !indexedYears.has(year));
  if (unexpectedYears.length) {
    throw new Error(
      `Season results exist for unsupported years: ${unexpectedYears.join(', ')}.`,
    );
  }
  const years = resultYears.map(Number);
  const historyByTeam: HistoryData['teams'] = {};
  const confIndex = new Map<string, number>();

  const getConferenceId = (name: string) => {
    const key = name || 'Independent';
    const existing = confIndex.get(key);
    if (existing !== undefined) return existing;
    const id = confIndex.size;
    confIndex.set(key, id);
    return id;
  };

  for (const year of years) {
    const [rawYearData, results] = await Promise.all([
      readJson<unknown>(join(dataRoot, 'years', `${year}.json`)),
      readJson<SeasonResultsData>(
        join(dataRoot, 'season-results', `${year}.json`),
      ),
    ]);
    const yearData = validateYearData(rawYearData, `Year ${year}`);

    for (const result of results.teams) {
      const prestige = getPrestige(result.team, yearData);
      if (prestige === undefined) {
        throw new Error(
          `Season results ${year}: ${result.team} is not in the year data.`,
        );
      }
      if (!historyByTeam[result.team]) historyByTeam[result.team] = [];
      historyByTeam[result.team].push([
        year,
        getConferenceId(result.conference),
        result.rank,
        result.wins,
        result.losses,
        prestige,
      ]);
    }
  }

  return {
    generated_at: new Date().toISOString(),
    years,
    conf_index: Object.fromEntries(confIndex),
    teams: historyByTeam,
  };
};

export const comparableHistory = ({
  generated_at: _generatedAt,
  ...history
}: HistoryData) => history;

const main = async () => {
  const outputPath = join(DATA_ROOT, 'history.json');
  const payload = await buildHistoryData();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote history data to ${outputPath}`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
