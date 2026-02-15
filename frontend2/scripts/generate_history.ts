/// <reference types="node" />
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type RatingsTeam = {
  team: string;
  conference: string;
  rank: number;
  wins: number;
  losses: number;
};

type RatingsData = {
  year: number;
  total_teams: number;
  teams: RatingsTeam[];
};

type YearData = {
  conferences: Record<string, { games: number; teams: Record<string, number> }>;
  Independent?: Record<string, number>;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', '..');
const RATINGS_DIR = join(ROOT, 'legacy', 'backend', 'data', 'ratings');
const YEARS_DIR = join(ROOT, 'legacy', 'backend', 'data', 'years');
const OUTPUT_PATH = join(ROOT, 'frontend2', 'public', 'data', 'history.json');

const readJson = async <T>(path: string) => JSON.parse(await readFile(path, 'utf-8')) as T;

const loadRatings = async (year: number) =>
  readJson<RatingsData>(join(RATINGS_DIR, `ratings_${year}.json`));

const loadYearData = async (year: number) => {
  const path = join(YEARS_DIR, `${year}.json`);
  await access(path);
  return readJson<YearData>(path);
};

const getPrestige = (teamName: string, yearData: YearData) => {
  for (const conf of Object.values(yearData.conferences ?? {})) {
    if (teamName in conf.teams) {
      return conf.teams[teamName];
    }
  }
  if (yearData.Independent && teamName in yearData.Independent) {
    return yearData.Independent[teamName];
  }
  return null;
};

const main = async () => {
  const yearFileNames = await readdir(YEARS_DIR);
  const years = yearFileNames
    .filter(name => name.endsWith('.json'))
    .map(name => Number(name.replace('.json', '')))
    .filter(year => !Number.isNaN(year))
    .sort((a, b) => b - a);

  if (!years.length) {
    throw new Error(`No year files found in ${YEARS_DIR}`);
  }

  const historyByTeam: Record<string, number[][]> = {};
  const confIndex = new Map<string, number>();

  const getConfId = (name: string) => {
    const key = name || 'Independent';
    const existing = confIndex.get(key);
    if (existing !== undefined) return existing;
    const id = confIndex.size;
    confIndex.set(key, id);
    return id;
  };

  for (const year of years) {
    const ratings = await loadRatings(year);
    const yearData = await loadYearData(year);

    ratings.teams.forEach(teamEntry => {
      const prestige = getPrestige(teamEntry.team, yearData);
      if (!historyByTeam[teamEntry.team]) historyByTeam[teamEntry.team] = [];
      const confId = getConfId(teamEntry.conference ?? 'Independent');
      historyByTeam[teamEntry.team].push([
        year,
        confId,
        teamEntry.rank ?? 0,
        teamEntry.wins ?? 0,
        teamEntry.losses ?? 0,
        prestige ?? null,
      ]);
    });
  }

  const payload = {
    generated_at: new Date().toISOString(),
    years,
    conf_index: Object.fromEntries(confIndex.entries()),
    teams: historyByTeam,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote history data to ${OUTPUT_PATH}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
