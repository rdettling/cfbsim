/// <reference types="node" />
import { copyFile, mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { validateBettingOddsData } from '../src/domain/baseDataValidation';
import { buildHistoricalGameProjections } from './data_build';
import { buildHistoryData, buildSeasonIndexData } from './build_history';
import { checkData } from './data_check';

let fixtureRoot: string | null = null;

const writeJson = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const writeCompactJson = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value)}\n`);

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const checkFixture = (dataRoot: string) => checkData(dataRoot, async () => ({
  seasonIndex: await buildSeasonIndexData(dataRoot),
  history: await buildHistoryData(dataRoot),
  bettingOdds: validateBettingOddsData(
    JSON.parse(await readFile(join(REPO_ROOT, 'public', 'data', 'betting_odds.json'), 'utf8')),
  ),
  ...await buildHistoricalGameProjections(dataRoot),
}));

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
      teams: { Alpha: 3, Beta: 2 },
    },
  },
  independents: {},
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
  it('accepts a complete consistent dataset', async () => {
    const dataRoot = await createFixture();
    await expect(checkFixture(dataRoot)).resolves.toEqual([]);
  });

  it('accepts the latest starting year without completed season results', async () => {
    const dataRoot = await createFixture();
    const scheduled = seasonData(2025, null);
    scheduled.conferences.Test.teams.Alpha = 2;
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

  it('rejects starting prestige outside metadata bounds and exact generated values', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'teams.json'), {
        teams: {
          Alpha: { ...teamMetadata('ALP'), ceiling: 2 },
          Beta: teamMetadata('BET'),
        },
      }),
      writeJson(join(dataRoot, 'prestige_config.json'), {
        1: 0,
        2: 0,
        3: 100,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
      }),
    ]);

    const errors = await checkFixture(dataRoot);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Alpha prestige 3 is outside metadata bounds 1-2',
        ),
        expect.stringContaining('generated starting prestige value(s) are stale'),
      ]),
    );
  });

  it('accepts an exact bounded distribution beyond the former tolerance', async () => {
    const dataRoot = await createFixture();
    const bounded = seasonData(2025);
    bounded.conferences.Test.teams = { Alpha: 3, Beta: 3 };
    await Promise.all([
      writeJson(join(dataRoot, 'seasons', '2025.json'), bounded),
      writeJson(join(dataRoot, 'prestige_config.json'), {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 100,
      }),
    ]);
    await writeJson(
      join(dataRoot, 'history.json'),
      await buildHistoryData(dataRoot),
    );

    await expect(checkFixture(dataRoot)).resolves.toEqual([]);
  });

  it('rejects one stale generated starting tier without writing it', async () => {
    const dataRoot = await createFixture();
    const seasonPath = join(dataRoot, 'seasons', '2025.json');
    const stale = seasonData(2025);
    stale.conferences.Test.teams.Alpha = 2;
    await writeJson(seasonPath, stale);
    const before = await readFile(seasonPath, 'utf8');

    await expect(checkFixture(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'seasons/2025.json: 1 generated starting prestige value(s) are stale',
        ),
      ]),
    );
    expect(await readFile(seasonPath, 'utf8')).toBe(before);
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
