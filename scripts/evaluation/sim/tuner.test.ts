import { describe, expect, it } from 'vitest';
import { SIM_CALIBRATION_BENCHMARK } from './calibrationBenchmark';
import {
  measureCalibration,
  scoreProductionMeasurements,
} from './calibrationMetrics';
import { SIM_TUNING } from '../../../src/domain/sim/config';
import {
  buildDriveConsistencyTuningCandidate,
  evaluateTuningCandidate,
  parseSimulationTuningArguments,
  searchSimulationTuning,
  type TuningCandidateEvaluation,
} from './tuner';

const productionAtTargets = () => Object.fromEntries(
  Object.entries(SIM_CALIBRATION_BENCHMARK.targets.production).map(([key, target]) => [
    key,
    measureCalibration(target.value, target),
  ]),
);

describe('simulation tuner', () => {
  it('parses defaults and explicit positive integers', () => {
    expect(parseSimulationTuningArguments([])).toEqual({
      seed: 20260809,
      gamesPerSeed: 200,
    });
    expect(parseSimulationTuningArguments([
      '--seed', '7', '--games-per-seed', '12',
    ])).toEqual({ seed: 7, gamesPerSeed: 12 });
    expect(() => parseSimulationTuningArguments(['--games', '2'])).toThrow(
      'Unknown simulation tuning argument',
    );
    expect(() => parseSimulationTuningArguments(['--seed', '0'])).toThrow(
      'positive integer',
    );
    expect(() => parseSimulationTuningArguments(['--seed'])).toThrow(
      'positive integer',
    );
  });

  it('searches deterministically with stable bounded parameter changes', () => {
    const evaluate = (tuning: typeof SIM_TUNING): TuningCandidateEvaluation => {
      const production = productionAtTargets();
      const target = SIM_CALIBRATION_BENCHMARK.targets.production.passPlayShare;
      production.passPlayShare = measureCalibration(tuning.playcalling.passWeightBase, target);
      return {
        production,
        score: scoreProductionMeasurements(production),
        gaps: production.passPlayShare.status === 'aligned'
          ? []
          : [`production.passPlayShare:${production.passPlayShare.status}`],
        violations: [],
      };
    };
    const first = searchSimulationTuning({ seed: 1, gamesPerSeed: 1 }, evaluate);
    const second = searchSimulationTuning({ seed: 1, gamesPerSeed: 1 }, evaluate);

    expect(first).toEqual(second);
    expect(first.candidate.changedParameters['playcalling.passWeightBase']).toEqual({
      before: SIM_TUNING.playcalling.passWeightBase,
      after: 0.49,
    });
    expect(first.configuration.evaluations).toBeGreaterThan(73);
    expect(first.configuration.parameters).toHaveLength(13);
    expect(SIM_TUNING.playcalling.passWeightBase).toBe(0.4734526815382582);
  });

  it('builds a bounded consistency seed with steadier open-field gains', () => {
    const candidate = buildDriveConsistencyTuningCandidate(SIM_TUNING);

    expect(candidate.outcomes.pass.baseMean).toBeGreaterThanOrEqual(
      SIM_TUNING.outcomes.pass.baseMean,
    );
    expect(candidate.outcomes.pass.positiveMultiplier).toBeLessThan(
      SIM_TUNING.outcomes.pass.positiveMultiplier,
    );
    expect(candidate.outcomes.run.baseMean).toBeGreaterThan(
      SIM_TUNING.outcomes.run.baseMean,
    );
    expect(candidate.outcomes.redZone.passPositiveYardsMultiplier).toBeLessThan(
      SIM_TUNING.outcomes.redZone.passPositiveYardsMultiplier,
    );
    expect(candidate.outcomes.drive.thirdDownPositiveYardsMultiplier).toBeLessThan(
      SIM_TUNING.outcomes.drive.thirdDownPositiveYardsMultiplier,
    );
    expect(SIM_TUNING.outcomes.redZone.passPositiveYardsMultiplier)
      .toBe(0.8086624971886522);
  });

  it('evaluates real games without leaking candidate tuning', () => {
    const original = structuredClone(SIM_TUNING);
    const candidate = structuredClone(SIM_TUNING);
    candidate.outcomes.baseCompPercent = 0.7;

    const result = evaluateTuningCandidate(candidate, { seed: 11, gamesPerSeed: 1 });

    expect(result.production.completionRate.engineValue).toBeGreaterThanOrEqual(0);
    expect(SIM_TUNING).toEqual(original);
  });
});
