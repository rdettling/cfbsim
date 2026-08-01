/// <reference types="node" />
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { buildHistoryData } from './generate_history';
import { checkData } from './check_data';

let fixtureRoot: string | null = null;

const writeJson = (path: string, value: unknown) =>
  writeFile(path, JSON.stringify(value, null, 2));

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

const createFixture = async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'cfbsim-data-'));
  const dataRoot = join(fixtureRoot, 'public', 'data');
  await Promise.all([
    mkdir(join(dataRoot, 'years'), { recursive: true }),
    mkdir(join(dataRoot, 'season-results'), { recursive: true }),
    mkdir(join(fixtureRoot, 'public', 'logos', 'teams'), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    writeJson(join(dataRoot, 'years', 'index.json'), { years: ['2025'] }),
    writeJson(join(dataRoot, 'years', '2025.json'), {
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
    }),
    writeJson(join(dataRoot, 'season-results', '2025.json'), {
      year: 2025,
      total_teams: 2,
      teams: [
        {
          team: 'Alpha',
          conference: 'Test',
          rank: 1,
          wins: 10,
          losses: 2,
        },
        {
          team: 'Beta',
          conference: 'Test',
          rank: 2,
          wins: 2,
          losses: 10,
        },
      ],
    }),
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
    await expect(checkData(dataRoot)).resolves.toEqual([]);
  });

  it('accepts the latest starting year without completed season results', async () => {
    const dataRoot = await createFixture();
    await unlink(join(dataRoot, 'season-results', '2025.json'));
    await writeJson(
      join(dataRoot, 'history.json'),
      await buildHistoryData(dataRoot),
    );

    await expect(checkData(dataRoot)).resolves.toEqual([]);
  });

  it('requires completed results for every older starting year', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'years', 'index.json'), {
        years: ['2025', '2024'],
      }),
      writeJson(join(dataRoot, 'years', '2024.json'), {
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
      }),
    ]);

    await expect(checkData(dataRoot)).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'season-results files: missing completed [2024]',
        ),
      ]),
    );
  });

  it('aggregates independent metadata, result, and history errors', async () => {
    const dataRoot = await createFixture();
    await Promise.all([
      writeJson(join(dataRoot, 'teams.json'), {
        teams: { Alpha: teamMetadata('ALP') },
      }),
      writeJson(join(dataRoot, 'conferences.json'), {}),
      writeJson(join(dataRoot, 'season-results', '2025.json'), {
        year: 2025,
        total_teams: 2,
        teams: [
          {
            team: 'Alpha',
            conference: 'Wrong',
            rank: 1,
            wins: 10,
            losses: 2,
          },
          {
            team: 'Alpha',
            conference: 'Test',
            rank: 2,
            wins: -1,
            losses: 10,
          },
        ],
      }),
    ]);

    const errors = await checkData(dataRoot);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing metadata for Beta'),
        expect.stringContaining('missing metadata for Test'),
        expect.stringContaining('duplicate team Alpha'),
        expect.stringContaining('missing team Beta'),
        expect.stringContaining('generated content is stale'),
      ]),
    );
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects starting prestige outside metadata bounds and tier tolerance', async () => {
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

    const errors = await checkData(dataRoot);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Alpha prestige 3 is outside metadata bounds 1-2',
        ),
        expect.stringContaining(
          'prestige 2 represents 50.00% of teams; target is 0%',
        ),
        expect.stringContaining(
          'prestige 3 represents 50.00% of teams; target is 100%',
        ),
      ]),
    );
  });
});
