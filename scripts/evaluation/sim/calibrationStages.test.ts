import { describe, expect, it } from 'vitest';
import { SIM_CALIBRATION_BENCHMARK } from './calibrationBenchmark';
import { measureCalibration } from './calibrationMetrics';
import {
  CALIBRATION_STAGES,
  groupCalibrationMeasurements,
  PRODUCTION_METRIC_STAGES,
} from './calibrationStages';

describe('simulation calibration stages', () => {
  it('assigns every production metric to exactly one causal stage', () => {
    const metricKeys = Object.keys(SIM_CALIBRATION_BENCHMARK.targets.production).sort();

    expect(Object.keys(PRODUCTION_METRIC_STAGES).sort()).toEqual(metricKeys);
    expect(Object.values(PRODUCTION_METRIC_STAGES).every(stage => (
      CALIBRATION_STAGES.includes(stage)
    ))).toBe(true);
  });

  it('groups production and score-distribution measurements without changing them', () => {
    const measurements = (targets: Record<string, { value: number; tolerance: {
      kind: 'relative' | 'absolute'; value: number;
    } }>) => Object.fromEntries(Object.entries(targets).map(([key, target]) => [
      key,
      measureCalibration(target.value, target),
    ]));
    const production = measurements(SIM_CALIBRATION_BENCHMARK.targets.production);
    const scoreDistribution = measurements(
      SIM_CALIBRATION_BENCHMARK.targets.scoreDistribution,
    );
    const grouped = groupCalibrationMeasurements(production, scoreDistribution);

    expect(grouped.score_distribution).toEqual(scoreDistribution);
    expect(grouped.play_mix).toEqual({ passPlayShare: production.passPlayShare });
    expect(Object.values(grouped).flatMap(group => Object.keys(group)).sort()).toEqual([
      ...Object.keys(production),
      ...Object.keys(scoreDistribution),
    ].sort());
  });
});
