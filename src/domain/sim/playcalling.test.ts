import { describe, expect, it } from 'vitest';
import { SIM_TUNING, withSimTuning } from './config';
import { decideFourthDown } from './playcalling';

describe('fourth-down decisions', () => {
  it('uses the modern fixed field-position and distance policy', () => {
    expect(decideFourthDown(40, 1, 0)).toBe('punt');
    expect(decideFourthDown(41, 2, 0)).toBe('go');
    expect(decideFourthDown(41, 3, 0)).toBe('punt');
    expect(decideFourthDown(50, 2, 0)).toBe('go');
    expect(decideFourthDown(50, 3, 0)).toBe('punt');
    expect(decideFourthDown(51, 3, 0)).toBe('go');
    expect(decideFourthDown(51, 4, 0)).toBe('punt');
    expect(decideFourthDown(62, 3, 0)).toBe('go');
    expect(decideFourthDown(62, 4, 0)).toBe('punt');
    expect(decideFourthDown(63, 4, 0)).toBe('go');
    expect(decideFourthDown(63, 5, 0)).toBe('field_goal');
  });

  it('preserves late-game points-needed overrides', () => {
    expect(decideFourthDown(20, 10, 1)).toBe('go');
    expect(decideFourthDown(70, 10, 3)).toBe('field_goal');
    expect(decideFourthDown(70, 10, 4)).toBe('go');
  });

  it('reads thresholds from scoped play-calling tuning', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.playcalling.fourthDown.midfieldGoMaxYards = 1;

    expect(withSimTuning(tuning, () => decideFourthDown(45, 2, 0))).toBe('punt');
    expect(SIM_TUNING.playcalling.fourthDown.midfieldGoMaxYards).toBe(2);
  });
});
