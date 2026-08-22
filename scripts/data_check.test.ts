/// <reference types="node" />
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { validateBettingOddsData } from '../src/domain/baseDataValidation';
import {
  buildHistoricalGameProjections,
  parseDataScope,
  runDataBuild,
  writeDataOutputs,
} from './data_build';
import { buildHistoryData, buildSeasonIndexData } from './build_history';
import { checkData } from './data_check';

let fixtureRoot: string | null = null;

const writeJson = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const writeCompactJson = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value)}\n`);

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const checkFixture = (dataRoot: string) => checkData(dataRoot, {
  buildOutputs: async () => ({
    seasonIndex: await buildSeasonIndexData(dataRoot),
    history: await buildHistoryData(dataRoot),
    bettingOdds: validateBettingOddsData(
      JSON.parse(await readFile(join(REPO_ROOT, 'public', 'data', 'betting_odds.json'), 'utf8')),
    ),
    ...await buildHistoricalGameProjections(dataRoot),
  }),
});

const teamMetadata = (abbreviation: string) => ({
  mascot: 'Testers',
  abbreviation,
  ceiling: 3,
  floor: 1,
  colorPrimary: '#123456',
  colorSecondary: '#ABCDEF',
  city: 'Test City',
  state: 'Test',
  stadium: 'Test Stadium',
});

const seasonData = (
  year: number,
  results: Record<string, { rank: number; wins: number; losses: number }> | null = {
    Alpha: { rank: 1, wins: 10, losses: 2 },
    Beta: { rank: 2, wins: 2, losses: 10 },
  },
) => ({
  year,
  playoff: {
    teams: 2,
    conf_champ_top_4: false,
    conf_champ_autobids: 0,
  },
  conferences: {
    Test: {
      games: 1,
      teams: ['Alpha', 'Beta'],
    },
  },
  independents: [],
  results,
});

const createFixture = async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'cfbsim-data-'));
  const dataRoot = join(fixtureRoot, 'public', 'data');
  await Promise.all([
    mkdir(join(dataRoot, 'seasons'), { recursive: true }),
    mkdir(join(dataRoot, 'historical-games'), { recursive: true }),
    mkdir(join(dataRoot, 'historical-games', 'by-team'), { recursive: true }),
    mkdir(join(fixtureRoot, 'public', 'logos', 'teams'), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    writeJson(join(dataRoot, 'seasons', 'index.json'), { years: ['2025'] }),
    writeJson(join(dataRoot, 'seasons', '2025.json'), seasonData(2025)),
    writeJson(join(dataRoot, 'teams.json'), {
      teams: {
        Alpha: teamMetadata('ALP'),
        Beta: teamMetadata('BET'),
      },
    }),
    writeJson(join(dataRoot, 'conferences.json'), {
      Test: 'Test Conference',
    }),
    writeJson(join(dataRoot, 'prestige_config.json'), {
      1: 0,
      2: 50,
      3: 50,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
    }),
    writeJson(join(dataRoot, 'rivalries.json'), { rivalries: [] }),
    copyFile(join(REPO_ROOT, 'public', 'data', 'names.json'), join(dataRoot, 'names.json')),
    copyFile(join(REPO_ROOT, 'public', 'data', 'states.json'), join(dataRoot, 'states.json')),
    copyFile(join(REPO_ROOT, 'public', 'data', 'betting_odds.json'), join(dataRoot, 'betting_odds.json')),
    writeJson(join(dataRoot, 'historical-games', 'index.json'), {
      source: 'CollegeFootballData.com',
      years: [2025],
    }),
    writeJson(join(dataRoot, 'historical-games', '2025.json'), {
      year: 2025,
      games: [{
        sourceId: 1,
        year: 2025,
        weekPlayed: 1,
        seasonType: 'regular',
        homeTeam: 'Alpha',
        awayTeam: 'Beta',
        homeScore: 24,
        awayScore: 17,
        homeRank: 0,
        awayRank: 0,
        neutralSite: false,
        venue: 'Test Stadium',
        name: null,
        label: 'Conference: Test',
      }],
    }),
    writeCompactJson(join(dataRoot, 'historical-games', 'by-team', 'Alpha.json'), {
      team: 'Alpha',
      games: [{
        sourceId: 1,
        year: 2025,
        weekPlayed: 1,
        opponent: 'Beta',
        location: 'Home',
        teamScore: 24,
        opponentScore: 17,
        label: 'Conference: Test',
      }],
    }),
    writeCompactJson(join(dataRoot, 'historical-games', 'by-team', 'Beta.json'), {
      team: 'Beta',
      games: [{
        sourceId: 1,
        year: 2025,
        weekPlayed: 1,
        opponent: 'Alpha',
        location: 'Away',
        teamScore: 17,
        opponentScore: 24,
        label: 'Conference: Test',
      }],
    }),
    writeFile(
      join(fixtureRoot, 'public', 'logos', 'teams', 'Alpha.png'),
      '',
    ),
    writeFile(
      join(fixtureRoot, 'public', 'logos', 'teams', 'Beta.png'),
      '',
    ),
  ]);
  await writeJson(join(dataRoot, 'history.json'), await buildHistoryData(dataRoot));
  return dataRoot;
};

afterEach(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true });
  fixtureRoot = null;
});

describe('checkData', () => {
  it('accepts exactly one supported scope', () => {
    expect(parseDataScope([])).toBe('all');
    expect(parseDataScope(['--scope', 'seasons'])).toBe('seasons');
    expect(parseDataScope(['--scope', 'odds'])).toBe('odds');
    expect(parseDataScope(['--scope', 'historical-games']))
      .toBe('historical-games');
    expect(() => parseDataScope(['--scope', 'unknown'])).toThrow();
    expect(() => parseDataScope(['--scope', 'seasons', '--scope', 'odds']))
      .toThrow();
    expect(() => parseDataScope(['--scope', 'seasons', 'odds'])).toThrow();
  });

  it('accepts a complete consistent dataset', async () => {
    const dataRoot = await createFixture();
    await expect(checkFixture(dataRoot)).resolves.toEqual([]);
  });

  it('builds and checks scopes without unrelated static inputs', async () => {
    let dataRoot = await createFixture();
    await Promise.all([
      rm(join(dataRoot, 'historical-games'), { recursive: true }),
      unlink(join(dataRoot, 'betting_odds.json')),
    ]);
    await expect(runDataBuild(dataRoot, 'seasons')).resolves.toMatchObject({
      seasonIndex: { years: ['2025'] },
    });
    await expect(checkData(dataRoot, { scope: 'seasons' })).resolves.toEqual([]);

    await rm(fixtureRoot!, { recursive: true });
    fixtureRoot = null;
    dataRoot = await createFixture();
    await Promise.all([
      rm(join(dataRoot, 'seasons'), { recursive: true }),
      unlink(join(dataRoot, 'teams.json')),
    ]);
    const bettingOdds = validateBettingOddsData(
      JSON.parse(await readFile(join(dataRoot, 'betting_odds.json'), 'utf8')),
    );
    await expect(checkData(dataRoot, {
      scope: 'odds',
      buildOutputs: async () => ({ bettingOdds }),
    })).resolves.toEqual([]);

    await rm(fixtureRoot!, { recursive: true });
    fixtureRoot = null;
    dataRoot = await createFixture();
    await Promise.all([
      unlink(join(dataRoot, 'history.json')),
      unlink(join(dataRoot, 'prestige_config.json')),
      unlink(join(dataRoot, 'conferences.json')),
      unlink(join(dataRoot, 'betting_odds.json')),
    ]);
    await expect(runDataBuild(dataRoot, 'historical-games')).resolves
      .toHaveProperty('historicalByTeam');
    await expect(checkData(dataRoot, { scope: 'historical-games' }))
      .resolves.toEqual([]);
  });

  it('leaves generated files and directories untouched when bytes match', async () => {
    const dataRoot = await createFixture();
    const paths = [
      join(dataRoot, 'seasons', 'index.json'),
      join(dataRoot, 'history.json'),
      join(dataRoot, 'betting_odds.json'),
      join(dataRoot, 'historical-games', 'index.json'),
      join(dataRoot, 'historical-games', 'by-team'),
    ];
    const before = await Promise.all(paths.map(path => stat(path).then(value => value.mtimeMs)));

    const bettingOdds = validateBettingOddsData(
      JSON.parse(await readFile(join(dataRoot, 'betting_odds.json'), 'utf8')),
    );
    await runDataBuild(dataRoot, 'seasons');
    await runDataBuild(dataRoot, 'historical-games');
    await writeDataOutputs({ bettingOdds }, dataRoot);
    await runDataBuild(dataRoot, 'seasons');
    await runDataBuild(dataRoot, 'historical-games');
    await writeDataOutputs({ bettingOdds }, dataRoot);

    const after = await Promise.all(paths.map(path => stat(path).then(value => value.mtimeMs)));
    expect(after).toEqual(before);
  });

  it('accepts the latest starting year without completed season results', async () => {
    const dataRoot = await createFixture();
    const scheduled = seasonData(2025, null);
    await writeJson(
      join(dataRoot, 'seasons', '2025.json'),
      scheduled,
    );
    await unlink(join(dataRoot, 'historical-games', '2025.json'));
    await writeJson(join(dataRoot, 'historical-games', 'index.json'), {
      source: 'CollegeFootballData.com',
      years: [],
    });
    await Promise.all([
      writeCompactJson(join(dataRoot, 'historical-games', 'by-team', 'Alpha.json'), {
        team: 'Alpha', games: [],
      }),
      writeCompactJson(join(dataRoot, 'historical-games', 'by-team', 'Beta.json'), {
        team: 'Beta', games: [],
      }),
    ]);
    await writeJson(
      join(dataRoot, 'history.json'),
      await buildHistoryData(dataRoot),
    );

    await expect(checkFixture(dataRoot)).resolves.toEqual([]);
  });

  it('allows completed seasons that are not yet in the history index', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'seasons', 'index.json'), {
        years: ['2025', '2024'],
      }),
      writeJson(join(dataRoot, 'seasons', '2024.json'), seasonData(2024)),
    ]);
    await writeJson(
      join(dataRoot, 'history.json'),
      await buildHistoryData(dataRoot),
    );

    await expect(checkFixture(dataRoot)).resolves.toEqual([]);
  });

  it('builds historical Prestige before adding each season result', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'seasons', '2024.json'), seasonData(2024)),
      writeJson(
        join(dataRoot, 'seasons', '2025.json'),
        seasonData(2025, {
          Beta: { rank: 1, wins: 10, losses: 2 },
          Alpha: { rank: 2, wins: 2, losses: 10 },
        }),
      ),
    ]);

    const first = await buildHistoryData(dataRoot);
    const second = await buildHistoryData(dataRoot);
    const alpha2024 = first.teams.Alpha.find(([year]) => year === 2024);
    const alpha2025 = first.teams.Alpha.find(([year]) => year === 2025);
    const beta2025 = first.teams.Beta.find(([year]) => year === 2025);
    if (!alpha2024 || !alpha2025 || !beta2025) {
      throw new Error('Expected both completed seasons in generated history.');
    }
    const [, , , , , alpha2024Prestige] = alpha2024;
    const [, , , , , alpha2025Prestige] = alpha2025;
    const [, , , , , beta2025Prestige] = beta2025;

    expect(alpha2024Prestige).toBe(2);
    expect(alpha2025Prestige).toBe(3);
    expect(beta2025Prestige).toBe(2);
    expect(second).toEqual(first);
  });

  it('rejects a season program missing from the catalog', async () => {
    const dataRoot = await createFixture();
    const season = seasonData(2025);
    season.conferences.Test.teams.push('Unknown');
    season.results = {
      Alpha: { rank: 1, wins: 10, losses: 2 },
      Beta: { rank: 2, wins: 2, losses: 10 },
      Unknown: { rank: 3, wins: 0, losses: 12 },
    };
    await writeJson(join(dataRoot, 'seasons', '2025.json'), season);

    await expect(checkData(dataRoot, {
      scope: 'seasons',
      buildOutputs: async () => ({
        seasonIndex: await buildSeasonIndexData(dataRoot),
        history: await buildHistoryData(dataRoot),
      }),
    })).resolves.toEqual(expect.arrayContaining([
      expect.stringContaining('teams.json: missing metadata for Unknown'),
    ]));
  });

  it('requires completed results for every older starting year', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'seasons', 'index.json'), {
        years: ['2025', '2024'],
      }),
      writeJson(
        join(dataRoot, 'seasons', '2024.json'),
        seasonData(2024, null),
      ),
    ]);

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'only the newest season may have null results; found 2024',
        ),
      ]),
    );
  });

  it('aggregates season, history, and projection errors', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'teams.json'), {
        teams: { Alpha: teamMetadata('ALP') },
      }),
      writeJson(join(dataRoot, 'conferences.json'), {}),
      writeJson(
        join(dataRoot, 'seasons', '2025.json'),
        seasonData(2025, {
          Alpha: { rank: 1, wins: 10, losses: 2 },
          Beta: { rank: 2, wins: -1, losses: 10 },
        }),
      ),
    ]);

    const errors = await checkFixture(dataRoot);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Beta.wins must be a nonnegative integer'),
        expect.stringContaining('conferences.json: data must not be empty'),
        expect.stringContaining('generated data'),
      ]),
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('requires season-result ranks to be contiguous ordinal positions', async () => {
    const dataRoot = await createFixture();
    await writeJson(
      join(dataRoot, 'seasons', '2025.json'),
      seasonData(2025, {
        Alpha: { rank: 2, wins: 10, losses: 2 },
        Beta: { rank: 2, wins: 2, losses: 10 },
      }),
    );

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('Alpha.rank must equal ordinal position 1'),
      ]),
    );
  });

  it('validates split historical-game file coverage', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      unlink(join(dataRoot, 'historical-games', '2025.json')),
      writeJson(join(dataRoot, 'historical-games', '2024.json'), {
        year: 2024,
        games: [],
      }),
    ]);

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing [2025]'),
        expect.stringContaining('unexpected [2024]'),
      ]),
    );
  });

  it('validates exact historical team-lookup coverage', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      unlink(join(dataRoot, 'historical-games', 'by-team', 'Alpha.json')),
      writeJson(join(dataRoot, 'historical-games', 'by-team', 'Orphan.json'), {
        team: 'Orphan',
        games: [],
      }),
    ]);

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing [Alpha.json]'),
        expect.stringContaining('unexpected [Orphan.json]'),
      ]),
    );
  });

  it('rejects a stale historical team lookup', async () => {
    const dataRoot = await createFixture();
    await writeJson(join(dataRoot, 'historical-games', 'by-team', 'Alpha.json'), {
      team: 'Alpha',
      games: [],
    });

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('Alpha.json: generated content is stale'),
      ]),
    );
  });

  it('rejects a valid but stale betting-odds table without writing', async () => {
    const dataRoot = await createFixture();
    const oddsPath = join(dataRoot, 'betting_odds.json');
    const odds = JSON.parse(await readFile(oddsPath, 'utf8'));
    odds.odds['0'].favWinProb = 0.5;
    odds.odds['0'].udWinProb = 0.5;
    await writeJson(oddsPath, odds);

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('betting_odds.json: generated content is stale'),
      ]),
    );
    expect(JSON.parse(await readFile(oddsPath, 'utf8')).odds['0'].favWinProb)
      .toBe(0.5);
  });

  it('rejects mismatched and unsupported historical games', async () => {
    const dataRoot = await createFixture();
    const seasonPath = join(dataRoot, 'historical-games', '2025.json');
    await writeJson(seasonPath, {
      year: 2025,
      games: [{
        sourceId: 1,
        year: 2025,
        weekPlayed: 1,
        seasonType: 'regular',
        homeTeam: 'Unknown A',
        awayTeam: 'Unknown B',
        homeScore: 24,
        awayScore: 17,
        homeRank: 0,
        awayRank: 0,
        neutralSite: false,
        venue: null,
        name: null,
        label: 'Non-Conference: Test vs Test',
      }],
    });
    const unsupportedErrors = await checkFixture(dataRoot);
    expect(unsupportedErrors).toEqual(expect.arrayContaining([
      expect.stringContaining('does not involve a supported program'),
    ]));

    await writeJson(seasonPath, { year: 2024, games: [] });
    const mismatchedErrors = await checkFixture(dataRoot);
    expect(mismatchedErrors).toEqual(expect.arrayContaining([
      expect.stringContaining('does not match the current schema'),
    ]));
  });

  it('requires every active program to appear in its indexed historical season', async () => {
    const dataRoot = await createFixture();
    await writeJson(join(dataRoot, 'historical-games', '2025.json'), {
      year: 2025,
      games: [{
        sourceId: 1,
        year: 2025,
        weekPlayed: 1,
        seasonType: 'regular',
        homeTeam: 'Alpha',
        awayTeam: 'Lower College',
        homeScore: 24,
        awayScore: 17,
        homeRank: 0,
        awayRank: 0,
        neutralSite: false,
        venue: null,
        name: null,
        label: 'Non-Conference: Test vs FCS',
      }],
    });

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('active programs without games [Beta]'),
      ]),
    );
  });

  it('does not require historical games for a program with a 0-0 record', async () => {
    const dataRoot = await createFixture();
    await writeJson(
      join(dataRoot, 'seasons', '2025.json'),
      seasonData(2025, {
        Alpha: { rank: 1, wins: 10, losses: 2 },
        Beta: { rank: 2, wins: 0, losses: 0 },
      }),
    );
    await writeJson(join(dataRoot, 'historical-games', '2025.json'), {
      year: 2025,
      games: [{
        sourceId: 1,
        year: 2025,
        weekPlayed: 1,
        seasonType: 'regular',
        homeTeam: 'Alpha',
        awayTeam: 'Lower College',
        homeScore: 24,
        awayScore: 17,
        homeRank: 0,
        awayRank: 0,
        neutralSite: false,
        venue: null,
        name: null,
        label: 'Non-Conference: Test vs FCS',
      }],
    });

    const errors = await checkFixture(dataRoot);
    expect(errors.some(error => error.includes('active programs without games')))
      .toBe(false);
  });
});
