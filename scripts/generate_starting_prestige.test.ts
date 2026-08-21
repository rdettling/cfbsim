/// <reference types="node" />
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SeasonData, TeamsData } from '../src/types/baseData';
import {
  buildStartingPrestigeCandidates,
  parseStartingPrestigeArgs,
  runStartingPrestigeGenerator,
} from './generate_starting_prestige';

const CONFIG = { 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 };
const temporaryDirectories: string[] = [];

const metadata = (
  abbreviation: string,
  floor = 1,
  ceiling = 7,
) => ({
  mascot: 'Testers',
  abbreviation,
  ceiling,
  floor,
  colorPrimary: '#123456',
  colorSecondary: '#ffffff',
  city: 'Test City',
  state: 'TS',
  stadium: 'Test Stadium',
});

const teamsData = (
  definitions: Record<string, ReturnType<typeof metadata>>,
): TeamsData => ({ teams: definitions });

const season = (
  year: number,
  teams: string[],
  options: {
    prestiges?: Record<string, number>;
    results?: string[] | null;
  } = {},
): SeasonData => ({
  year,
  playoff: {
    teams: 2,
    conf_champ_top_4: false,
    conf_champ_autobids: 0,
  },
  conferences: {
    Test: {
      games: Math.min(teams.length - 1, 12),
      teams: Object.fromEntries(
        teams.map(team => [team, options.prestiges?.[team] ?? 4]),
      ),
    },
  },
  independents: {},
  results: options.results === null
    ? null
    : Object.fromEntries((options.results ?? teams).map((team, index) => [
        team,
        { rank: index + 1, wins: teams.length - index, losses: index },
      ])),
});

const auditFor = (
  result: ReturnType<typeof buildStartingPrestigeCandidates>,
  year: number,
  team: string,
) => result.audits
  .find(audit => audit.year === year)!
  .teamAudits.find(audit => audit.team === team)!;

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })));
});

describe('starting prestige generation', () => {
  it('uses all available prior results and fills a short window with current results', () => {
    const seasons = [2000, 2001, 2002, 2003, 2004]
      .map(year => season(year, ['Alpha', 'Beta']));
    const result = buildStartingPrestigeCandidates({
      seasons,
      teams: teamsData({ Alpha: metadata('ALP'), Beta: metadata('BET') }),
      prestigeConfig: CONFIG,
    });

    expect(auditFor(result, 2000, 'Alpha').observationYears).toEqual([2000]);
    expect(auditFor(result, 2001, 'Alpha').observationYears).toEqual([2000, 2001]);
    expect(auditFor(result, 2002, 'Alpha').observationYears).toEqual([2000, 2001, 2002]);
    expect(auditFor(result, 2003, 'Alpha').observationYears)
      .toEqual([2000, 2001, 2002, 2003]);
    expect(auditFor(result, 2004, 'Alpha').observationYears)
      .toEqual([2000, 2001, 2002, 2003]);
  });

  it('uses a current result for a new program with no prior finish', () => {
    const result = buildStartingPrestigeCandidates({
      seasons: [
        season(2024, ['Alpha', 'Beta']),
        season(2025, ['Alpha', 'Beta', 'New State'], {
          results: ['Alpha', 'New State', 'Beta'],
        }),
      ],
      teams: teamsData({
        Alpha: metadata('ALP'),
        Beta: metadata('BET'),
        'New State': metadata('NEW'),
      }),
      prestigeConfig: CONFIG,
    });

    expect(auditFor(result, 2025, 'New State')).toMatchObject({
      observationYears: [2025],
      averageFinish: 2,
      usedMidpointFallback: false,
    });
  });

  it('normalizes each finish with its source season team count', () => {
    const result = buildStartingPrestigeCandidates({
      seasons: [
        season(2024, ['Alpha', 'Beta', 'Gamma'], {
          results: ['Beta', 'Alpha', 'Gamma'],
        }),
        season(2025, ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'], {
          results: ['Beta', 'Gamma', 'Alpha', 'Delta', 'Epsilon'],
        }),
      ],
      teams: teamsData({
        Alpha: metadata('ALP'),
        Beta: metadata('BET'),
        Gamma: metadata('GAM'),
        Delta: metadata('DEL'),
        Epsilon: metadata('EPS'),
      }),
      prestigeConfig: CONFIG,
    });

    expect(auditFor(result, 2025, 'Alpha')).toMatchObject({
      observationYears: [2024, 2025],
      score: 50,
      averageFinish: 2.5,
    });
  });

  it('uses the rounded bounds midpoint when no result exists', () => {
    const source = season(
      2026,
      ['Sacramento State', 'North Dakota State'],
      {
        prestiges: { 'Sacramento State': 2, 'North Dakota State': 2 },
        results: null,
      },
    );
    const result = buildStartingPrestigeCandidates({
      seasons: [source],
      teams: teamsData({
        'Sacramento State': metadata('SAC', 1, 4),
        'North Dakota State': metadata('NDS', 2, 5),
      }),
      prestigeConfig: CONFIG,
    });

    expect(auditFor(result, 2026, 'Sacramento State')).toMatchObject({
      after: 3,
      usedMidpointFallback: true,
    });
    expect(auditFor(result, 2026, 'North Dakota State')).toMatchObject({
      after: 4,
      usedMidpointFallback: true,
    });
  });

  it('changes only embedded prestige values', () => {
    const source = season(2025, ['Alpha', 'Beta'], {
      prestiges: { Alpha: 1, Beta: 7 },
    });
    const result = buildStartingPrestigeCandidates({
      seasons: [source],
      teams: teamsData({ Alpha: metadata('ALP'), Beta: metadata('BET') }),
      prestigeConfig: CONFIG,
    });
    const generated = result.seasons[0];

    expect(generated.playoff).toEqual(source.playoff);
    expect(generated.results).toEqual(source.results);
    expect(Object.keys(generated.conferences)).toEqual(Object.keys(source.conferences));
    expect(Object.keys(generated.conferences.Test.teams))
      .toEqual(Object.keys(source.conferences.Test.teams));
  });

  it('parses audit, check, and write modes exactly', () => {
    expect(parseStartingPrestigeArgs([])).toBe('audit');
    expect(parseStartingPrestigeArgs(['--check'])).toBe('check');
    expect(parseStartingPrestigeArgs(['--write'])).toBe('write');
    expect(() => parseStartingPrestigeArgs(['--write', '--check'])).toThrow();
    expect(() => parseStartingPrestigeArgs(['--unknown'])).toThrow();
  });
});

const createDataRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), 'cfbsim-starting-prestige-'));
  temporaryDirectories.push(root);
  const dataRoot = join(root, 'public', 'data');
  await mkdir(join(dataRoot, 'seasons'), { recursive: true });
  const source = season(2025, ['Alpha', 'Beta'], {
    prestiges: { Alpha: 1, Beta: 7 },
  });
  await Promise.all([
    writeFile(
      join(dataRoot, 'seasons', '2025.json'),
      `${JSON.stringify(source, null, 2)}\n`,
    ),
    writeFile(
      join(dataRoot, 'seasons', 'index.json'),
      `${JSON.stringify({ years: ['2025'] }, null, 2)}\n`,
    ),
    writeFile(
      join(dataRoot, 'teams.json'),
      `${JSON.stringify(teamsData({
        Alpha: metadata('ALP'),
        Beta: metadata('BET'),
      }), null, 2)}\n`,
    ),
    writeFile(
      join(dataRoot, 'prestige_config.json'),
      `${JSON.stringify(CONFIG, null, 2)}\n`,
    ),
  ]);
  return dataRoot;
};

describe('starting prestige command', () => {
  it('keeps audit and failed check read-only, then writes and checks exact data', async () => {
    const dataRoot = await createDataRoot();
    const path = join(dataRoot, 'seasons', '2025.json');
    const before = await readFile(path, 'utf8');

    await expect(runStartingPrestigeGenerator({ dataRoot, mode: 'audit' }))
      .resolves.toMatchObject({ audits: [{ changed: 2 }] });
    expect(await readFile(path, 'utf8')).toBe(before);
    await expect(runStartingPrestigeGenerator({ dataRoot, mode: 'check' }))
      .rejects.toThrow('2 starting prestige value(s) are stale');
    expect(await readFile(path, 'utf8')).toBe(before);

    await expect(runStartingPrestigeGenerator({ dataRoot, mode: 'write' }))
      .resolves.toMatchObject({ audits: [{ changed: 2 }] });
    expect(await readFile(path, 'utf8')).not.toBe(before);
    await expect(runStartingPrestigeGenerator({ dataRoot, mode: 'check' }))
      .resolves.toMatchObject({ audits: [{ changed: 0 }] });
  });

  it('does not replace any season when staging fails', async () => {
    const dataRoot = await createDataRoot();
    const path = join(dataRoot, 'seasons', '2025.json');
    const before = await readFile(path, 'utf8');
    await unlink(join(dataRoot, 'seasons', 'index.json'));

    await expect(runStartingPrestigeGenerator({ dataRoot, mode: 'write' }))
      .rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(before);
  });
});
