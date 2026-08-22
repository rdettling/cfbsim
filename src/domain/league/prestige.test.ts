import { describe, expect, it } from 'vitest';
import type { HistoryData, PrestigeConfig, TeamsData } from '../../types/baseData';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import {
  applyPrestigeChanges,
  calculateStartingPrestiges,
  calculatePrestigeChanges,
  evaluatePrestigePrograms,
  normalizePrestigeFinish,
  type PrestigeProgramInput,
} from './prestige';

const config = (
  overrides: Partial<PrestigeConfig> = {},
): PrestigeConfig => ({
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 15,
  6: 10,
  7: 5,
  ...overrides,
});

const program = (
  id: number,
  overrides: Partial<PrestigeProgramInput> = {},
): PrestigeProgramInput => ({
  id,
  name: `Team ${id}`,
  currentPrestige: 4,
  floor: 1,
  ceiling: 7,
  observations: [{ year: 2025, rank: id, teamCount: 10 }],
  ...overrides,
});

const teamsData = (bounds: Record<string, [number, number]>): TeamsData => ({
  teams: Object.fromEntries(Object.entries(bounds).map(([name, [floor, ceiling]]) => [
    name,
    {
      mascot: name,
      abbreviation: name.slice(0, 3).toUpperCase(),
      ceiling,
      floor,
      colorPrimary: '#000000',
      colorSecondary: '#ffffff',
      city: name,
      state: 'Test',
      stadium: `${name} Stadium`,
    },
  ])),
});

describe('prestige evaluation', () => {
  it('calculates a 2026 start from 2023 through 2025 only', () => {
    const history: HistoryData = {
      years: [2026, 2025, 2024, 2023, 2022],
      conf_index: { Test: 1 },
      teams: {
        Alpha: [
          [2026, 1, 100, 0, 0, 1],
          [2025, 1, 1, 0, 0, 1],
          [2024, 1, 1, 0, 0, 1],
          [2023, 1, 1, 0, 0, 1],
          [2022, 1, 100, 0, 0, 1],
        ],
        Beta: [
          [2026, 1, 1, 0, 0, 7],
          [2025, 1, 2, 0, 0, 7],
          [2024, 1, 2, 0, 0, 7],
          [2023, 1, 2, 0, 0, 7],
          [2022, 1, 1, 0, 0, 7],
        ],
      },
    };

    expect(calculateStartingPrestiges({
      year: 2026,
      teamNames: ['Alpha', 'Beta'],
      historyData: history,
      teamsData: teamsData({ Alpha: [1, 7], Beta: [1, 7] }),
      prestigeConfig: config({ 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 }),
    })).toEqual({ Alpha: 7, Beta: 1 });
  });

  it('uses one or two available prior finishes and the bounds midpoint without history', () => {
    const history: HistoryData = {
      years: [2025, 2024],
      conf_index: { Test: 1 },
      teams: {
        Alpha: [[2025, 1, 1, 0, 0, 1]],
        Beta: [[2025, 1, 2, 0, 0, 7], [2024, 1, 2, 0, 0, 7]],
      },
    };

    expect(calculateStartingPrestiges({
      year: 2026,
      teamNames: ['Alpha', 'Beta', 'Gamma'],
      historyData: history,
      teamsData: teamsData({ Alpha: [1, 7], Beta: [1, 7], Gamma: [2, 5] }),
      prestigeConfig: config({ 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 }),
    })).toEqual({ Alpha: 7, Beta: 7, Gamma: 4 });
  });

  it('normalizes equivalent finishes across league sizes and handles one team', () => {
    expect(normalizePrestigeFinish(6, 11)).toBe(50);
    expect(normalizePrestigeFinish(51, 101)).toBe(50);
    expect(normalizePrestigeFinish(1, 1)).toBe(100);
  });

  it.each([1, 2, 3, 4])(
    'averages every available finish in a %i-season window',
    seasons => {
      const observations = Array.from({ length: seasons }, (_, index) => ({
        year: 2025 - index,
        rank: index + 1,
        teamCount: 5,
      }));

      const [evaluated] = evaluatePrestigePrograms(
        [program(1, { observations })],
        config({ 1: 0, 2: 0, 3: 0, 4: 100, 5: 0, 6: 0, 7: 0 }),
      );

      expect(evaluated.seasons).toBe(seasons);
      expect(evaluated.averageRank).toBe((seasons + 1) / 2);
      expect(evaluated.score).toBe(
        observations.reduce(
          (sum, observation) =>
            sum + normalizePrestigeFinish(observation.rank, observation.teamCount),
          0,
        ) / seasons,
      );
    },
  );

  it('sorts by the unrounded performance score', () => {
    const evaluated = evaluatePrestigePrograms([
      program(1, {
        name: 'Zulu',
        observations: [{ year: 2025, rank: 6, teamCount: 11 }],
      }),
      program(2, {
        name: 'Alpha',
        observations: [{ year: 2025, rank: 5005, teamCount: 10001 }],
      }),
    ], config({ 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 }));

    expect(evaluated.map(entry => entry.name)).toEqual(['Zulu', 'Alpha']);
    expect(evaluated.map(entry => entry.rawTargetPrestige)).toEqual([7, 1]);
    expect(evaluated[0].score?.toFixed(1)).toBe(
      evaluated[1].score?.toFixed(1),
    );
  });

  it('covers the full league with rounded cumulative bands, including zero tiers', () => {
    const distribution = config({ 1: 50, 2: 0, 3: 0, 4: 30, 5: 0, 6: 0, 7: 20 });
    const evaluated = evaluatePrestigePrograms(
      Array.from({ length: 10 }, (_, index) => program(index + 1)),
      distribution,
    );

    expect(evaluated.map(entry => entry.rawTargetPrestige)).toEqual([
      7, 7, 4, 4, 4, 1, 1, 1, 1, 1,
    ]);
  });

  it('applies bounds independently and permits multi-tier movement', () => {
    const evaluated = evaluatePrestigePrograms(
      [
        program(1, { currentPrestige: 1, ceiling: 7 }),
        program(2, { currentPrestige: 6, ceiling: 3 }),
        ...Array.from({ length: 8 }, (_, index) => program(index + 3)),
      ],
      config({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 100 }),
    );

    expect(evaluated.find(entry => entry.id === 1)).toMatchObject({
      rawTargetPrestige: 7,
      targetPrestige: 7,
      change: 6,
    });
    expect(evaluated.find(entry => entry.id === 2)).toMatchObject({
      rawTargetPrestige: 7,
      targetPrestige: 3,
      change: -3,
    });
    expect(evaluated.find(entry => entry.id === 3)?.rawTargetPrestige).toBe(7);
  });

  it('preserves bounded current prestige when no finish is available', () => {
    expect(evaluatePrestigePrograms([
      program(1, {
        currentPrestige: 5,
        floor: 2,
        ceiling: 6,
        observations: [],
      }),
    ], config({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 100 }))[0])
      .toMatchObject({ seasons: 0, score: null, targetPrestige: 5, change: 0 });
  });

  it('breaks score ties by latest finish and then program name', () => {
    const tied = [
      program(1, {
        name: 'Zulu',
        observations: [
          { year: 2024, rank: 1, teamCount: 10 },
          { year: 2025, rank: 10, teamCount: 10 },
        ],
      }),
      program(2, {
        name: 'Alpha',
        observations: [
          { year: 2024, rank: 10, teamCount: 10 },
          { year: 2025, rank: 1, teamCount: 10 },
        ],
      }),
      program(3, {
        name: 'Beta',
        observations: [
          { year: 2024, rank: 10, teamCount: 10 },
          { year: 2025, rank: 1, teamCount: 10 },
        ],
      }),
    ];

    expect(evaluatePrestigePrograms(tied, config()).map(entry => entry.name))
      .toEqual(['Alpha', 'Beta', 'Zulu']);
  });

  it('uses exactly three years and replaces canonical current-year history', () => {
    const league = buildTestLeague('summary', {
      info: {
        ...buildTestLeague('summary').info,
        currentYear: 2025,
        stage: 'summary',
      },
      teams: [
        buildTestTeam({ id: 1, name: 'Alpha', ranking: 1, prestige: 1 }),
        buildTestTeam({ id: 2, name: 'Beta', ranking: 2, prestige: 7 }),
      ],
    });
    const history: HistoryData = {
      years: [2025, 2024, 2023],
      conf_index: { Test: 1 },
      teams: {
        Alpha: [
          [2025, 1, 2, 0, 0, 1],
          [2024, 1, 2, 0, 0, 1],
          [2023, 1, 1, 0, 0, 1],
          [2022, 1, 2, 0, 0, 1],
        ],
        Beta: [
          [2025, 1, 1, 0, 0, 7],
          [2024, 1, 1, 0, 0, 7],
          [2023, 1, 2, 0, 0, 7],
          [2022, 1, 1, 0, 0, 7],
        ],
      },
    };

    const changes = calculatePrestigeChanges(
      league,
      history,
      config({ 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 }),
    );

    expect(changes.Alpha).toMatchObject({
      targetPrestige: 7,
      change: 6,
      before: { averageRank: 5 / 3, seasons: 3 },
      after: { averageRank: 4 / 3, seasons: 3 },
    });
    expect(changes.Beta.targetPrestige).toBe(1);

    applyPrestigeChanges(league, changes);
    expect(league.teams.map(team => team.prestige)).toEqual([7, 1]);
  });
});
