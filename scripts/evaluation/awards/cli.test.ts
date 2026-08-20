import { describe, expect, it } from 'vitest';
import {
  deriveAwardSeedFamily,
  parseAwardEvaluationArguments,
} from './cli';

describe('awards evaluation CLI', () => {
  it('defaults to the agent iteration profile and validates arguments', () => {
    expect(parseAwardEvaluationArguments([])).toEqual({
      profile: 'iterate',
      seed: 20260815,
      output: '.artifacts/awards-audit',
    });
    expect(parseAwardEvaluationArguments(['--profile', 'acceptance', '--seed', '7', '--output', 'tmp']))
      .toEqual({ profile: 'acceptance', seed: 7, output: 'tmp' });
    expect(() => parseAwardEvaluationArguments(['--profile', 'manual']))
      .toThrow('--profile must be smoke, iterate, or acceptance');
  });

  it('derives deterministic, disjoint iteration and acceptance seed families', () => {
    const iterate = deriveAwardSeedFamily('iterate', 42);
    const acceptance = deriveAwardSeedFamily('acceptance', 42);
    expect(deriveAwardSeedFamily('iterate', 42)).toEqual(iterate);
    expect(iterate).toHaveLength(3);
    expect(acceptance).toHaveLength(10);
    expect(iterate.some(seed => acceptance.includes(seed))).toBe(false);
  });
});
