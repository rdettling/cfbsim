import { describe, expect, it, vi } from 'vitest';
import {
  chooseDefensiveIntent,
  DEFENSIVE_INTENTS,
  defensiveProfile,
  defensiveIntentWeights,
} from './defensiveIntents';
import { OFFENSIVE_CONCEPTS } from './concepts';

const situation = (
  overrides: Partial<Parameters<typeof defensiveIntentWeights>[0]> = {},
) => ({
  down: 1,
  yardsLeft: 5,
  fieldPosition: 25,
  offenseLead: 0,
  clock: { quarter: 1, secondsLeft: 900, clockRunning: true },
  ...overrides,
});

describe('defensive intents', () => {
  it('uses the committed base mixture', () => {
    expect(defensiveIntentWeights(situation())).toEqual({
      base: 0.4,
      loaded_box: 0.2,
      coverage: 0.25,
      pressure: 0.15,
    });
  });

  it('applies short, long, red-zone, and late-game preferences', () => {
    const short = defensiveIntentWeights(situation({ yardsLeft: 2 }));
    expect(short.loaded_box).toBeGreaterThan(0.2);
    expect(short.pressure).toBeGreaterThan(0.15);

    const long = defensiveIntentWeights(situation({ yardsLeft: 9 }));
    expect(long.coverage).toBeGreaterThan(0.25);
    expect(long.pressure).toBeGreaterThan(0.15);

    const redZone = defensiveIntentWeights(situation({ fieldPosition: 85 }));
    expect(redZone.loaded_box).toBeGreaterThan(0.2);
    expect(redZone.coverage).toBeGreaterThan(0.25);

    const protectingLead = defensiveIntentWeights(situation({
      offenseLead: -7,
      clock: { quarter: 4, secondsLeft: 180, clockRunning: true },
    }));
    expect(protectingLead.coverage).toBeGreaterThan(0.25);

    const trailing = defensiveIntentWeights(situation({
      offenseLead: 7,
      clock: { quarter: 4, secondsLeft: 180, clockRunning: true },
    }));
    expect(trailing.loaded_box).toBeGreaterThan(0.2);
    expect(trailing.pressure).toBeGreaterThan(0.15);
  });

  it('is keyed by play ID and does not consume Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    expect(chooseDefensiveIntent(12345, situation()))
      .toBe(chooseDefensiveIntent(12345, situation()));
    expect(random).not.toHaveBeenCalled();
  });

  it('defines finite positive matchup modifiers for every intent and concept', () => {
    for (const intent of DEFENSIVE_INTENTS) {
      for (const concept of OFFENSIVE_CONCEPTS) {
        expect(Object.values(defensiveProfile(intent, concept)).every(value => (
          Number.isFinite(value) && value > 0
        ))).toBe(true);
      }
    }
    expect(Object.values(defensiveProfile('base', 'deep_pass'))).toEqual(
      Array(7).fill(1),
    );
    expect(defensiveProfile('loaded_box', 'inside_run').meanMultiplier).toBeLessThan(1);
    expect(defensiveProfile('coverage', 'deep_pass').completionMultiplier).toBeLessThan(1);
    expect(defensiveProfile('pressure', 'play_action').sackMultiplier).toBeGreaterThan(1);
    expect(defensiveProfile('pressure', 'screen').sackMultiplier).toBeLessThan(
      defensiveProfile('pressure', 'deep_pass').sackMultiplier,
    );
  });
});
