import { describe, expect, it } from 'vitest';
import { SIM_CALIBRATION_BENCHMARK } from './calibrationBenchmark';
import {
  compareTuningScores,
  measureCalibration,
  poolProductionMeasurements,
  productionCalibrationGaps,
  scoreProductionMeasurements,
  validateProductionMeasurements,
} from './calibrationMetrics';

const productionAtTargets = () => Object.fromEntries(
  Object.entries(SIM_CALIBRATION_BENCHMARK.targets.production).map(([key, target]) => [
    key,
    measureCalibration(target.value, target),
  ]),
);

describe('simulation calibration metrics', () => {
  it('requires the exact finite production metric set', () => {
    const complete = productionAtTargets();
    expect(() => validateProductionMeasurements('Production', complete)).not.toThrow();

    const missing = { ...complete };
    delete missing.puntsPerGame;
    expect(() => validateProductionMeasurements('Production', missing))
      .toThrow('exact production metric set');

    const extra = { ...complete, inventedMetric: complete.puntsPerGame };
    expect(() => validateProductionMeasurements('Production', extra))
      .toThrow('exact production metric set');

    const nonFinite = productionAtTargets();
    nonFinite.puntsPerGame = {
      ...nonFinite.puntsPerGame,
      engineValue: Number.NaN,
    };
    expect(() => validateProductionMeasurements('Production', nonFinite))
      .toThrow('non-finite');
  });

  it('pools samples and scores gaps deterministically', () => {
    const first = productionAtTargets();
    const second = productionAtTargets();
    const target = SIM_CALIBRATION_BENCHMARK.targets.production.puntsPerGame;
    second.puntsPerGame = measureCalibration(target.value * 1.22, target);

    const pooled = poolProductionMeasurements([first, second]);
    expect(pooled.puntsPerGame.engineValue).toBeCloseTo(target.value * 1.11);
    expect(productionCalibrationGaps(pooled)).toEqual([
      'production.puntsPerGame:high',
    ]);
    expect(compareTuningScores(
      scoreProductionMeasurements(first),
      scoreProductionMeasurements(pooled),
    )).toBeLessThan(0);
  });
});
