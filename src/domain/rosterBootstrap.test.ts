import { describe, expect, it } from 'vitest';
import {
  buildTestLeague,
  buildTestNamesData,
  buildTestTeam,
} from '../test/fixtures';
import { createSeededRandom } from './utils/random';
import {
  buildBootstrapClassTargets,
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

const buildInput = () => {
  const team = buildTestTeam({ prestige: 7 });
  return {
    league: buildTestLeague('preseason', { teams: [team] }),
    names,
    states: { TS: 1 },
    random: createSeededRandom(88),
  };
};

describe('seeded initial-roster preparation', () => {
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
    const averageStars = (teamId: number) => {
      const roster = players.filter(player => player.teamId === teamId);
      return roster.reduce((sum, player) => sum + player.stars, 0) / roster.length;
    };
    expect(averageStars(firstEntry.id)).toBeGreaterThan(
      averageStars(secondEntry.id),
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
