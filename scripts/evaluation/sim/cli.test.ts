import { describe, expect, it } from 'vitest';
import {
  parseSimulationEvaluationArguments,
  simulationEvaluationExitCode,
} from './cli';

describe('simulation evaluation CLI', () => {
  it('uses the representative defaults', () => {
    expect(parseSimulationEvaluationArguments([])).toEqual({
      seed: 20260809,
      gamesPerDiff: 1000,
    });
  });

  it('accepts explicit seed and sample size', () => {
    expect(parseSimulationEvaluationArguments([
      '--seed', '42',
      '--games-per-diff', '250',
    ])).toEqual({ seed: 42, gamesPerDiff: 250 });
  });

  it('accepts a unique signed rating-response grid', () => {
    expect(parseSimulationEvaluationArguments([
      '--rating-differences', '-35,-14,0,14,35',
    ])).toEqual({
      seed: 20260809,
      gamesPerDiff: 1000,
      ratingDifferences: [-35, -14, 0, 14, 35],
    });
  });

  it.each([
    [['--seed'], '--seed must be an integer'],
    [['--seed', '0'], '--seed must be an integer'],
    [['--seed', '-1'], '--seed must be an integer'],
    [['--games-per-diff', '0'], '--games-per-diff must be an integer'],
    [['--rating-differences', ''], '--rating-differences'],
    [['--rating-differences', '0,0'], '--rating-differences'],
    [['--rating-differences', '75'], '--rating-differences'],
    [['--rating-differences', 'seven'], '--rating-differences'],
    [['--unknown', '1'], 'Unknown simulation evaluation argument'],
  ])('rejects invalid arguments', (arguments_, message) => {
    expect(() => parseSimulationEvaluationArguments(arguments_)).toThrow(message);
  });

  it('fails only when violations exist', () => {
    expect(simulationEvaluationExitCode({ violations: [] })).toBe(0);
    expect(simulationEvaluationExitCode({ violations: ['failure'] })).toBe(1);
  });
});
