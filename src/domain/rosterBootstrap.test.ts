import { describe, expect, it } from 'vitest';
import type { HistoryData } from '../types/baseData';
import {
  buildTestLeague,
  buildTestNamesData,
  buildTestTeam,
} from '../test/fixtures';
import { createSeededRandom } from './utils/random';
import {
  buildBootstrapClassTargets,
  buildBootstrapPrestigesByClass,
  prepareInitialRostersFromData,
  prepareProgramEntryRostersFromData,
} from './rosterBootstrap';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from './rosterConfig';

const names = buildTestNamesData({
  black: {
    first: [{ name: 'Alex', weight: 1 }],
    last: [{ name: 'Player', weight: 1 }],
  },
  white: {
    first: [{ name: 'Sam', weight: 1 }],
    last: [{ name: 'Tester', weight: 1 }],
  },
});

const buildHistory = (
  teams: HistoryData['teams'] = {},
): HistoryData => ({
  years: [2025, 2024, 2023, 2022, 2021],
  conf_index: { Test: 0 },
  teams,
});

const historyRow = (
  year: number,
  prestige: number,
): HistoryData['teams'][string][number] => [year, 0, 1, 12, 0, prestige];

const buildInput = (historyData = buildHistory()) => {
  const team = buildTestTeam({ prestige: 7 });
  return {
    league: buildTestLeague('preseason', {
      info: {
        ...buildTestLeague('preseason').info,
        currentYear: 2026,
        startYear: 2026,
      },
      teams: [team],
    }),
    historyData,
    names,
    states: { TS: 1 },
    random: createSeededRandom(88),
  };
};

describe('seeded initial-roster preparation', () => {
  it('maps current and historical prestige to the four initial classes', () => {
    const rising = buildTestTeam({ id: 1, name: 'Rising', prestige: 7 });
    const declining = buildTestTeam({ id: 2, name: 'Declining', prestige: 3 });
    const before = structuredClone([rising, declining]);
    const prestiges = buildBootstrapPrestigesByClass(
      [rising, declining],
      buildHistory({
        Rising: [historyRow(2025, 6), historyRow(2024, 5), historyRow(2023, 4)],
        Declining: [historyRow(2025, 4), historyRow(2024, 5), historyRow(2023, 6)],
      }),
      2026,
    );

    expect(prestiges).toEqual({
      1: { fr: 7, so: 6, jr: 5, sr: 4 },
      2: { fr: 3, so: 4, jr: 5, sr: 6 },
    });
    expect([rising, declining]).toEqual(before);
  });

  it('uses nearest pre-start history with earlier-year tie-breaking', () => {
    const team = buildTestTeam({ prestige: 7 });
    const prestiges = buildBootstrapPrestigesByClass(
      [team],
      buildHistory({
        [team.name]: [
          historyRow(2027, 1),
          historyRow(2025, 6),
          historyRow(2023, 4),
          historyRow(2021, 2),
        ],
      }),
      2026,
    );

    expect(prestiges[team.id]).toEqual({ fr: 7, so: 6, jr: 4, sr: 4 });
  });

  it('uses current prestige when the program has no pre-start history', () => {
    const team = buildTestTeam({ prestige: 5 });

    expect(buildBootstrapPrestigesByClass(
      [team],
      buildHistory({ [team.name]: [historyRow(2027, 1)] }),
      2026,
    )[team.id]).toEqual({ fr: 5, so: 5, jr: 5, sr: 5 });
  });

  it('is deterministic with four exact 20-player classes', () => {
    const first = prepareInitialRostersFromData(buildInput());
    const second = prepareInitialRostersFromData(buildInput());

    expect(first).toEqual(second);
    expect(first).toHaveLength(FINAL_ROSTER_SIZE);
    expect(new Set(first.map(player => player.id)).size).toBe(first.length);
    expect(new Set(first.map(player => player.year))).toEqual(
      new Set(['fr', 'so', 'jr', 'sr']),
    );
    POSITION_ORDER.forEach(position => {
      expect(
        first.filter(player => player.pos === position),
      ).toHaveLength(ROSTER[position].total);
    });
    (['fr', 'so', 'jr', 'sr'] as const).forEach(year => {
      expect(first.filter(player => player.year === year)).toHaveLength(20);
    });
  });

  it('reproduces current-prestige bootstrap when every class has that prestige', () => {
    const currentHistory = buildHistory({
      'Test State': [
        historyRow(2025, 7),
        historyRow(2024, 7),
        historyRow(2023, 7),
      ],
    });
    const first = buildInput(currentHistory);
    const second = buildInput();
    const firstPlayers = prepareInitialRostersFromData(first);
    const secondPlayers = prepareInitialRostersFromData(second);

    expect(firstPlayers).toEqual(secondPlayers);
    expect(first.league.teams).toEqual(second.league.teams);
    expect(first.league.teams[0].prestige).toBe(7);
  });

  it('distributes positional remainders exactly and deterministically', () => {
    const first = buildBootstrapClassTargets();
    expect(first).toEqual(buildBootstrapClassTargets());
    expect(first).toHaveLength(4);
    first.forEach(targets => {
      expect(Object.values(targets).reduce((sum, value) => sum + value, 0))
        .toBe(20);
    });
    POSITION_ORDER.forEach(position => {
      expect(
        first.reduce((sum, targets) => sum + targets[position], 0),
      ).toBe(ROSTER[position].total);
    });
  });

  it('stagger positional class patterns across programs', () => {
    const teams = Array.from({ length: 4 }, (_, index) =>
      buildTestTeam({ id: index + 1, name: `Team ${index + 1}` }),
    );
    const input = buildInput();
    input.league.teams = teams;
    const players = prepareInitialRostersFromData(input);

    expect(
      teams.map(team =>
        players.filter(
          player =>
            player.teamId === team.id &&
            player.year === 'sr' &&
            player.pos === 'k',
        ).length,
      ),
    ).toEqual([1, 0, 0, 1]);
    teams.forEach(team => {
      const roster = players.filter(player => player.teamId === team.id);
      (['fr', 'so', 'jr', 'sr'] as const).forEach(year => {
        expect(roster.filter(player => player.year === year)).toHaveLength(20);
      });
      POSITION_ORDER.forEach(position => {
        expect(roster.filter(player => player.pos === position)).toHaveLength(
          ROSTER[position].total,
        );
      });
    });
  });

  it('prepares full entry rosters without changing incumbent teams or rankings', () => {
    const incumbents = Array.from({ length: 138 }, (_, index) =>
      buildTestTeam({
        id: index + 1,
        prestige: (index % 7) + 1,
        ranking: index + 1,
        rating: index === 0 ? 95 : 80,
      }),
    );
    const firstEntry = buildTestTeam({ id: 139, prestige: 5, ranking: 139 });
    const secondEntry = buildTestTeam({ id: 140, prestige: 2, ranking: 140 });
    const league = buildTestLeague('realignment', {
      teams: [...incumbents, firstEntry, secondEntry],
      idCounters: { game: 2, player: 50 },
    });
    const incumbentBefore = structuredClone(incumbents[0]);
    const players = prepareProgramEntryRostersFromData({
      league,
      teams: [firstEntry, secondEntry],
      names,
      states: { TS: 1 },
      random: createSeededRandom(91),
    });

    expect(players).toHaveLength(FINAL_ROSTER_SIZE * 2);
    expect(players.map(player => player.id)).toEqual(
      Array.from({ length: FINAL_ROSTER_SIZE * 2 }, (_, index) => 50 + index),
    );
    expect(incumbents[0]).toEqual(incumbentBefore);
    expect(firstEntry.ranking).toBe(139);
    expect(secondEntry.ranking).toBe(140);
    const averageRating = (teamId: number) => {
      const roster = players.filter(player => player.teamId === teamId);
      return roster.reduce((sum, player) => sum + player.rating, 0) / roster.length;
    };
    expect(averageRating(firstEntry.id)).toBeGreaterThan(
      averageRating(secondEntry.id),
    );
    for (const team of [firstEntry, secondEntry]) {
      const roster = players.filter(player => player.teamId === team.id);
      expect(roster).toHaveLength(FINAL_ROSTER_SIZE);
      expect(Number.isFinite(team.offense)).toBe(true);
      expect(Number.isFinite(team.defense)).toBe(true);
      expect(Number.isFinite(team.rating)).toBe(true);
      (['fr', 'so', 'jr', 'sr'] as const).forEach(year => {
        expect(roster.filter(player => player.year === year)).toHaveLength(20);
      });
      POSITION_ORDER.forEach(position => {
        expect(roster.filter(player => player.pos === position)).toHaveLength(
          ROSTER[position].total,
        );
        expect(
          roster.filter(player => player.pos === position && player.starter),
        ).toHaveLength(ROSTER[position].starters);
      });
    }
  });
});
