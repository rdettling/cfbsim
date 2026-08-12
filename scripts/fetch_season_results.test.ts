/// <reference types="node" />
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addKnownMissingRecords,
  parseFetchSeasonResultsArgs,
  runFetchSeasonResults,
} from './fetch_season_results';

const temporaryDirectories: string[] = [];
const teams = Array.from({ length: 25 }, (_, index) => `Team ${index + 1}`);

const makeDataRoot = async (years = [2025]) => {
  const root = await mkdtemp(join(tmpdir(), 'cfbsim-season-results-'));
  temporaryDirectories.push(root);
  const dataRoot = join(root, 'public', 'data');
  await mkdir(join(dataRoot, 'seasons'), { recursive: true });
  await writeFile(
    join(dataRoot, 'seasons', 'index.json'),
    `${JSON.stringify({ years: years.map(String).toReversed() }, null, 2)}\n`,
  );
  for (const year of years) {
    await writeFile(join(dataRoot, 'seasons', `${year}.json`), `${JSON.stringify({
      year,
      playoff: {
        teams: 12,
        conf_champ_autobids: 5,
        conf_champ_top_4: true,
      },
      conferences: {
        Test: { games: 12, teams: Object.fromEntries(teams.map(team => [team, 3])) },
      },
      independents: {},
      results: null,
    }, null, 2)}\n`);
  }
  return dataRoot;
};

const completedResults = () => Object.fromEntries(teams.map((team, index) => [
  team,
  { rank: index + 1, wins: 8, losses: 4 },
]));

const makeCompleted = async (dataRoot: string, year: number) => {
  const path = join(dataRoot, 'seasons', `${year}.json`);
  const season = JSON.parse(await readFile(path, 'utf8'));
  season.results = completedResults();
  await writeFile(path, `${JSON.stringify(season, null, 2)}\n`);
};

const apiResponse = (input: string | URL | Request) => {
  const url = String(input);
  const year = Number(new URL(url).searchParams.get('year'));
  if (url.includes('/rankings')) return [{
    season: year,
    seasonType: 'postseason',
    week: 1,
    polls: [{
      poll: 'AP Top 25',
      ranks: teams.map((school, index) => ({ school, rank: index + 1 })),
    }],
  }];
  if (url.includes('/ratings/')) return teams.map((team, index) => ({
    year,
    team,
    ranking: index + 1,
    rating: 100 - index,
  }));
  return teams.map(team => ({
    year,
    team,
    classification: 'fbs',
    total: { games: 12, wins: 8, losses: 4, ties: 0 },
  }));
};

const fetchImpl = vi.fn(async input =>
  new Response(JSON.stringify(apiResponse(input)), { status: 200 }));

afterEach(async () => {
  fetchImpl.mockClear();
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

describe('season results fetching', () => {
  it('fills only the two known canceled-team records in 2020', () => {
    expect(addKnownMissingRecords([], 2020)).toEqual([
      {
        year: 2020,
        team: 'Connecticut',
        classification: 'fbs',
        total: { games: 0, wins: 0, losses: 0, ties: 0 },
      },
      {
        year: 2020,
        team: 'Old Dominion',
        classification: 'fbs',
        total: { games: 0, wins: 0, losses: 0, ties: 0 },
      },
    ]);
    expect(addKnownMissingRecords([], 2021)).toEqual([]);
  });

  it('parses supported command modes', () => {
    expect(parseFetchSeasonResultsArgs(['--year', '2025'])).toEqual({
      selection: { type: 'year', year: 2025 },
      mode: 'create',
    });
    expect(parseFetchSeasonResultsArgs(['--all', '--refresh'])).toEqual({
      selection: { type: 'all' },
      mode: 'refresh',
    });
    expect(() => parseFetchSeasonResultsArgs([])).toThrow('exactly one');
    expect(() => parseFetchSeasonResultsArgs(['--all'])).toThrow('requires');
    expect(() => parseFetchSeasonResultsArgs([
      '--year', '2025', '--refresh', '--check',
    ])).toThrow('cannot be combined');
  });

  it('populates a scheduled season using the three CFBD endpoints', async () => {
    const dataRoot = await makeDataRoot();
    const audits = await runFetchSeasonResults({
      apiKey: 'test',
      dataRoot,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      options: { selection: { type: 'year', year: 2025 }, mode: 'create' },
    });
    expect(audits).toEqual([{
      year: 2025,
      teams: 25,
      apAvailable: 25,
      ratingTeams: 25,
      ratingSource: 'SRS',
    }]);
    expect(fetchImpl.mock.calls.map(([input]) => String(input))).toEqual([
      'https://api.collegefootballdata.com/rankings?year=2025&seasonType=postseason',
      'https://api.collegefootballdata.com/ratings/srs?year=2025',
      'https://api.collegefootballdata.com/records?year=2025',
    ]);
    const result = JSON.parse(await readFile(
      join(dataRoot, 'seasons', '2025.json'),
      'utf8',
    ));
    expect(Object.keys(result.results)).toHaveLength(25);
    expect(result.results['Team 25'].rank).toBe(25);
  });

  it('uses SP+ for the complete 2020 power-rating field', async () => {
    const dataRoot = await makeDataRoot([2020]);
    const audits = await runFetchSeasonResults({
      apiKey: 'test',
      dataRoot,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      options: { selection: { type: 'year', year: 2020 }, mode: 'create' },
    });
    expect(audits[0].ratingSource).toBe('SP+');
    expect(fetchImpl.mock.calls.map(([input]) => String(input))).toContain(
      'https://api.collegefootballdata.com/ratings/sp?year=2020',
    );
    expect(fetchImpl.mock.calls.map(([input]) => String(input))).not.toContain(
      'https://api.collegefootballdata.com/ratings/srs?year=2020',
    );
  });

  it('refuses an implicit overwrite before fetching', async () => {
    const dataRoot = await makeDataRoot();
    await makeCompleted(dataRoot, 2025);
    await expect(runFetchSeasonResults({
      apiKey: 'test',
      dataRoot,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      options: { selection: { type: 'year', year: 2025 }, mode: 'create' },
    })).rejects.toThrow('already has results');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('checks deterministic output without writing', async () => {
    const dataRoot = await makeDataRoot();
    await runFetchSeasonResults({
      apiKey: 'test', dataRoot, fetchImpl: fetchImpl as unknown as typeof fetch,
      options: { selection: { type: 'year', year: 2025 }, mode: 'create' },
    });
    const before = await readFile(join(dataRoot, 'seasons', '2025.json'), 'utf8');
    await expect(runFetchSeasonResults({
      apiKey: 'test', dataRoot, fetchImpl: fetchImpl as unknown as typeof fetch,
      options: { selection: { type: 'year', year: 2025 }, mode: 'check' },
    })).resolves.toHaveLength(1);
    expect(await readFile(join(dataRoot, 'seasons', '2025.json'), 'utf8'))
      .toBe(before);
  });

  it('preserves existing single-year and all-year files after a fetch failure', async () => {
    const dataRoot = await makeDataRoot();
    const target = join(dataRoot, 'seasons', '2025.json');
    await makeCompleted(dataRoot, 2025);
    const before = await readFile(target, 'utf8');
    const failingFetch = vi.fn(async input =>
      String(input).includes('/ratings/srs')
        ? new Response('failure', { status: 500 })
        : new Response(JSON.stringify(apiResponse(input)), { status: 200 }));

    for (const options of [
      { selection: { type: 'year' as const, year: 2025 }, mode: 'refresh' as const },
      { selection: { type: 'all' as const }, mode: 'refresh' as const },
    ]) {
      await expect(runFetchSeasonResults({
        apiKey: 'test', dataRoot,
        fetchImpl: failingFetch as unknown as typeof fetch,
        options,
      })).rejects.toThrow('SRS request failed');
      expect(await readFile(target, 'utf8')).toBe(before);
    }
  });
});
