import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import { createSeededRandom } from './recruiting/random';
import {
  buildBootstrapClassTargets,
  prepareInitialRostersFromData,
} from './rosterBootstrap';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from './rosterConfig';

const names = {
  black: {
    first: [{ name: 'Alex', weight: 1 }],
    last: [{ name: 'Player', weight: 1 }],
  },
  white: {
    first: [{ name: 'Sam', weight: 1 }],
    last: [{ name: 'Tester', weight: 1 }],
  },
};

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
});
