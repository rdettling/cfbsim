import { describe, expect, it } from 'vitest';
import {
  parseSimulationEvaluationArguments,
  simulationEvaluationExitCode,
} from './evaluationCli';

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

  it.each([
    [['--seed'], '--seed must be an integer'],
    [['--seed', '0'], '--seed must be an integer'],
    [['--seed', '-1'], '--seed must be an integer'],
    [['--games-per-diff', '0'], '--games-per-diff must be an integer'],
    [['--unknown', '1'], 'Unknown simulation evaluation argument'],
  ])('rejects invalid arguments', (arguments_, message) => {
    expect(() => parseSimulationEvaluationArguments(arguments_)).toThrow(message);
  });

  it('fails only when violations exist', () => {
    expect(simulationEvaluationExitCode({ violations: [] })).toBe(0);
    expect(simulationEvaluationExitCode({ violations: ['failure'] })).toBe(1);
  });
});
