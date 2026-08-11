import { describe, expect, it } from 'vitest';
import { SIM_TUNING, withSimTuning } from './config';

describe('scoped simulation tuning', () => {
  it('applies a candidate only inside the callback', () => {
    const original = structuredClone(SIM_TUNING);
    const candidate = structuredClone(SIM_TUNING);
    candidate.outcomes.baseCompPercent = 0.7;

    const observed = withSimTuning(candidate, () => SIM_TUNING.outcomes.baseCompPercent);

    expect(observed).toBe(0.7);
    expect(SIM_TUNING).toEqual(original);
  });

  it('restores the original tuning when the callback throws', () => {
    const original = structuredClone(SIM_TUNING);
    const candidate = structuredClone(SIM_TUNING);
    candidate.outcomes.baseCompPercent = 0.7;

    expect(() => withSimTuning(candidate, () => {
      throw new Error('stop');
    })).toThrow('stop');

    expect(SIM_TUNING).toEqual(original);
  });
});
