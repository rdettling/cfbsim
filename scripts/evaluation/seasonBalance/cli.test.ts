import { describe, expect, it } from 'vitest';
import {
  deriveSeasonBalanceSeedFamily,
  parseSeasonBalanceArguments,
} from './cli';

describe('season-balance evaluation CLI', () => {
  it('defaults to iteration and validates profile, seed, and output', () => {
    expect(parseSeasonBalanceArguments([])).toEqual({
      profile: 'iterate',
      seed: 20260822,
      output: '.artifacts/season-balance',
    });
    expect(parseSeasonBalanceArguments([
      '--profile', 'acceptance',
      '--seed', '7',
      '--output', 'tmp',
    ])).toEqual({ profile: 'acceptance', seed: 7, output: 'tmp' });
    expect(() => parseSeasonBalanceArguments(['--profile', 'manual']))
      .toThrow('--profile must be smoke, iterate, or acceptance');
    expect(() => parseSeasonBalanceArguments(['--seed', '-1']))
      .toThrow('--seed must be an integer from 0 through 4294967295');
    expect(() => parseSeasonBalanceArguments(['--output', '']))
      .toThrow('--output must be a nonempty path');
  });

  it('derives deterministic disjoint profile seed families', () => {
    const smoke = deriveSeasonBalanceSeedFamily('smoke', 42);
    const iterate = deriveSeasonBalanceSeedFamily('iterate', 42);
    const acceptance = deriveSeasonBalanceSeedFamily('acceptance', 42);
    expect(deriveSeasonBalanceSeedFamily('acceptance', 42)).toEqual(acceptance);
    expect(smoke).toHaveLength(1);
    expect(iterate).toHaveLength(10);
    expect(acceptance).toHaveLength(40);
    expect(iterate.some(seed => acceptance.includes(seed))).toBe(false);
    expect(smoke.some(seed => iterate.includes(seed) || acceptance.includes(seed))).toBe(false);
  });
});
