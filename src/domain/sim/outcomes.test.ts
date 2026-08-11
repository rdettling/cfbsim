import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { SIM_TUNING, withSimTuning } from './config';
import {
  fieldGoal,
  fieldGoalProbability,
  simPass,
  simRun,
  type SimOutcomeContext,
} from './outcomes';

const offense = buildTestTeam({ id: 1, offense: 75, defense: 75 });
const defense = buildTestTeam({ id: 2, offense: 75, defense: 75 });

const mockRunRandomness = () => vi.spyOn(Math, 'random')
  .mockReturnValueOnce(0.99)
  .mockReturnValueOnce(0.5)
  .mockReturnValueOnce(0.25);

const mockPassRandomness = () => vi.spyOn(Math, 'random')
  .mockReturnValueOnce(0.99)
  .mockReturnValueOnce(0)
  .mockReturnValueOnce(0.99)
  .mockReturnValueOnce(0.5)
  .mockReturnValueOnce(0.25);

afterEach(() => vi.restoreAllMocks());

describe('simulation outcomes', () => {
  it('uses a continuous bounded monotonic field-goal curve', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.fieldGoal.accuracyMultiplier = 1;
    const probabilities = withSimTuning(tuning, () => {
      expect(fieldGoalProbability(20)).toBeCloseTo(0.97);
      expect(fieldGoalProbability(30)).toBeCloseTo(0.97);
      expect(fieldGoalProbability(40)).toBeCloseTo(0.88);
      expect(fieldGoalProbability(50)).toBeCloseTo(0.7);
      expect(fieldGoalProbability(60)).toBeCloseTo(0.4);
      expect(fieldGoalProbability(72)).toBeCloseTo(0.05);
      expect(fieldGoalProbability(100)).toBeCloseTo(0.05);
      return Array.from({ length: 81 }, (_, index) => (
        fieldGoalProbability(20 + index)
      ));
    });
    expect(probabilities.every(Number.isFinite)).toBe(true);
    expect(probabilities.every(value => value >= 0 && value <= 1)).toBe(true);
    expect(probabilities.every((value, index) => (
      index === 0 || value <= probabilities[index - 1]
    ))).toBe(true);
  });

  it('uses exactly one football random draw for every field-goal attempt', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(fieldGoal(90)).toBe(true);
    expect(random).toHaveBeenCalledTimes(1);

    random.mockClear();
    expect(fieldGoal(40)).toBe(false);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it('applies run red-zone shaping only from the opponent twenty on scrimmage plays', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.redZone.runPositiveYardsMultiplier = 0.6;
    const unshaped = structuredClone(tuning);
    unshaped.outcomes.redZone.runPositiveYardsMultiplier = 1;

    const outside = withSimTuning(tuning, () => {
      mockRunRandomness();
      return simRun(
        'inside_run', 'base', 79, { kind: 'scrimmage', down: 1 }, offense, defense,
      );
    });
    vi.restoreAllMocks();
    const inside = withSimTuning(tuning, () => {
      mockRunRandomness();
      return simRun(
        'inside_run', 'base', 80, { kind: 'scrimmage', down: 1 }, offense, defense,
      );
    });
    vi.restoreAllMocks();
    const outsideWithoutShaping = withSimTuning(unshaped, () => {
      mockRunRandomness();
      return simRun(
        'inside_run', 'base', 79, { kind: 'scrimmage', down: 1 }, offense, defense,
      );
    });

    expect(outside.yards).toBe(outsideWithoutShaping.yards);
    expect(inside.yards).toBeLessThan(outside.yards);
  });

  it('does not apply red-zone shaping to negative yardage', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.redZone.runPositiveYardsMultiplier = 0.6;
    const sample = (fieldPosition: number) => withSimTuning(tuning, () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.99)
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.5);
      return simRun(
        'inside_run', 'base', fieldPosition, { kind: 'scrimmage', down: 3 }, offense, defense,
      );
    });

    const outside = sample(79);
    vi.restoreAllMocks();
    const inside = sample(80);

    expect(outside.yards).toBeLessThan(0);
    expect(inside.yards).toBe(outside.yards);
  });

  it('applies pass shaping independently and excludes two-point tries', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.pass.baseMean = 3;
    tuning.outcomes.pass.positiveMultiplier = 0;
    tuning.outcomes.redZone.passPositiveYardsMultiplier = 0.6;

    const scrimmage = withSimTuning(tuning, () => {
      mockPassRandomness();
      return simPass(
        'intermediate_pass', 'base', 97, { kind: 'scrimmage', down: 1 }, offense, defense,
      );
    });
    vi.restoreAllMocks();
    const attempt = withSimTuning(tuning, () => {
      mockPassRandomness();
      return simPass(
        'intermediate_pass', 'base', 97, { kind: 'try' }, offense, defense,
      );
    });

    expect(scrimmage).toEqual({ outcome: 'pass', yards: 2 });
    expect(attempt).toEqual({ outcome: 'touchdown', yards: 3 });
  });

  it('applies third-down shaping without consuming additional randomness', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.drive.thirdDownPositiveYardsMultiplier = 1.25;
    const sample = (down: 2 | 3 | 4) => withSimTuning(tuning, () => {
      const random = mockRunRandomness();
      const result = simRun(
        'inside_run', 'base', 50, { kind: 'scrimmage', down }, offense, defense,
      );
      return { result, calls: random.mock.calls.length };
    });

    const second = sample(2);
    vi.restoreAllMocks();
    const third = sample(3);
    vi.restoreAllMocks();
    const fourth = sample(4);

    expect(third.result.yards).toBeGreaterThan(second.result.yards);
    expect(fourth.result.yards).toBe(second.result.yards);
    expect([second.calls, third.calls, fourth.calls]).toEqual([3, 3, 3]);
  });

  it('composes third-down and red-zone gain shaping', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.drive.thirdDownPositiveYardsMultiplier = 1.25;
    tuning.outcomes.redZone.runPositiveYardsMultiplier = 0.6;
    tuning.outcomes.run.baseMean = 6;
    tuning.outcomes.run.positiveMultiplier = 0;
    const sample = (down: 2 | 3) => withSimTuning(tuning, () => {
      mockRunRandomness();
      return simRun(
        'inside_run', 'base', 80, { kind: 'scrimmage', down }, offense, defense,
      );
    });

    const second = sample(2);
    vi.restoreAllMocks();
    const third = sample(3);

    expect(second.yards).toBe(4);
    expect(third.yards).toBe(5);
  });

  it('does not shape negative third-down gains or untimed tries', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.outcomes.drive.thirdDownPositiveYardsMultiplier = 1.25;
    tuning.outcomes.run.baseMean = -2;
    tuning.outcomes.run.positiveMultiplier = 0;
    const sample = (context: SimOutcomeContext) => withSimTuning(tuning, () => {
      mockRunRandomness();
      return simRun('inside_run', 'base', 50, context, offense, defense);
    });

    const second = sample({ kind: 'scrimmage', down: 2 });
    vi.restoreAllMocks();
    const third = sample({ kind: 'scrimmage', down: 3 });
    expect(third.yards).toBe(second.yards);

    vi.restoreAllMocks();
    tuning.outcomes.run.baseMean = 4;
    const attempt = sample({ kind: 'try' });
    expect(attempt.yards).toBe(4);
  });
});
