import { describe, expect, it } from 'vitest';
import { createSeededRandom, withSeededMathRandom } from '../utils/random';
import {
  chooseOffensiveCall,
  conceptWeights,
  isPlayCall,
  playTypeForCall,
  validatePlayCall,
} from './concepts';

const situation = (overrides: Partial<Parameters<typeof conceptWeights>[1]> = {}) => ({
  down: 1,
  yardsLeft: 10,
  fieldPosition: 25,
  lead: 0,
  clock: { quarter: 1, secondsLeft: 900, clockRunning: true },
  ...overrides,
});

describe('offensive concepts', () => {
  it('uses the committed base mixtures', () => {
    expect(conceptWeights('run', situation({ yardsLeft: 5 }))).toEqual({
      inside_run: 0.5,
      outside_run: 0.35,
      option: 0.15,
    });
    expect(conceptWeights('pass', situation({ yardsLeft: 5 }))).toEqual({
      quick_pass: 0.25,
      intermediate_pass: 0.3,
      deep_pass: 0.15,
      screen: 0.15,
      play_action: 0.15,
    });
  });

  it('applies short, long, red-zone, and late-game situation preferences', () => {
    const shortRun = conceptWeights('run', situation({ yardsLeft: 2 }));
    expect(shortRun.inside_run).toBeGreaterThan(shortRun.outside_run);
    expect(shortRun.option).toBeGreaterThan(0.15);

    const longPass = conceptWeights('pass', situation({ down: 3, yardsLeft: 9 }));
    expect(longPass.deep_pass).toBeGreaterThan(0.15);
    expect(longPass.screen).toBeGreaterThan(0.15);

    const redZone = conceptWeights('pass', situation({ fieldPosition: 85, yardsLeft: 5 }));
    expect(redZone.deep_pass).toBeLessThan(0.15);
    expect(redZone.play_action).toBeGreaterThan(0.15);

    const trailing = conceptWeights('pass', situation({
      lead: -7,
      clock: { quarter: 4, secondsLeft: 180, clockRunning: true },
      yardsLeft: 5,
    }));
    expect(trailing.quick_pass).toBeGreaterThan(0.25);
    expect(trailing.play_action).toBeLessThan(0.15);

    const leading = conceptWeights('run', situation({
      lead: 7,
      clock: { quarter: 4, secondsLeft: 180, clockRunning: true },
      yardsLeft: 5,
    }));
    expect(leading.inside_run).toBeGreaterThan(0.5);
    expect(leading.option).toBeLessThan(0.15);
  });

  it('selects seeded calls deterministically', () => {
    const first = withSeededMathRandom(
      createSeededRandom(1234),
      () => chooseOffensiveCall('pass', situation()),
    );
    const second = withSeededMathRandom(
      createSeededRandom(1234),
      () => chooseOffensiveCall('pass', situation()),
    );
    expect(second).toEqual(first);
  });

  it('validates exact calls, situations, and coarse play types', () => {
    expect(isPlayCall({ kind: 'scrimmage', offense: 'screen', defense: 'base' })).toBe(true);
    expect(isPlayCall({
      kind: 'scrimmage',
      offense: 'screen',
      defense: 'base',
      extra: true,
    })).toBe(false);
    expect(isPlayCall({ kind: 'scrimmage', offense: 'screen' })).toBe(false);
    expect(isPlayCall({ kind: 'try', attempt: 'extra_point' })).toBe(true);
    expect(isPlayCall({ kind: 'try', attempt: 'extra_point', offense: 'inside_run' })).toBe(false);
    expect(isPlayCall({
      kind: 'try',
      attempt: 'two_point',
      offense: 'screen',
      defense: 'coverage',
    })).toBe(true);
    expect(isPlayCall({
      kind: 'try',
      attempt: 'two_point',
      offense: 'screen',
      defense: 'coverage',
      tempo: 'normal',
    })).toBe(false);
    expect(isPlayCall({
      kind: 'scrimmage',
      offense: 'screen',
      defense: 'prevent',
    })).toBe(false);
    expect(isPlayCall({
      kind: 'special_teams',
      concept: 'punt',
      defense: 'pressure',
    })).toBe(false);
    expect(playTypeForCall({
      kind: 'scrimmage',
      offense: 'option',
      defense: 'loaded_box',
    })).toBe('run');
    expect(playTypeForCall({ kind: 'try', attempt: 'extra_point' })).toBe('extra point');
    expect(playTypeForCall({
      kind: 'try',
      attempt: 'two_point',
      offense: 'quick_pass',
      defense: 'base',
    })).toBe('pass');
    expect(validatePlayCall(
      { kind: 'special_teams', concept: 'punt' },
      1,
      'punt',
    )).toContain('special teams before fourth down');
    expect(validatePlayCall(
      { kind: 'scrimmage', offense: 'deep_pass', defense: 'coverage' },
      2,
      'run',
    )).toContain('call and play type disagree');
  });
});
