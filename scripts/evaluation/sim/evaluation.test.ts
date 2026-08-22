import { describe, expect, it } from 'vitest';
import {
  evaluateSimulation,
  measureEqualTeamSimulation,
  SIM_EVALUATION_BASELINE_CHECKSUM,
} from './evaluation';
import { summarizeDistribution } from './evaluationMetrics';

describe('simulation evaluation', () => {
  it('is reproducible and restores Math.random', () => {
    const original = Math.random;
    const first = evaluateSimulation({ seed: 1234, gamesPerDiff: 10 });
    const second = evaluateSimulation({ seed: 1234, gamesPerDiff: 10 });
    const different = evaluateSimulation({ seed: 1235, gamesPerDiff: 10 });
    expect(Math.random).toBe(original);
    expect(second).toEqual(first);
    expect(different.checksum).not.toBe(first.checksum);
    expect(first.violations).toEqual(second.violations);
    expect(first.ratingResults).toHaveLength(4);
    expect(first.ratingResults.every(result => (
      Number.isFinite(result.marginStandardDeviation)
      && Number.isFinite(result.medianMargin)
      && Number.isFinite(result.p90Margin)
    ))).toBe(true);
  });

  it('summarizes empty and populated game distributions', () => {
    expect(summarizeDistribution([])).toEqual({
      mean: 0,
      standardDeviation: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
    });
    expect(summarizeDistribution([0, 10, 20, 30])).toMatchObject({
      mean: 15,
      p25: 7.5,
      p50: 15,
      p75: 22.5,
    });
  });

  it('reuses the authoritative loop for equal-team candidate measurement', () => {
    const full = evaluateSimulation({ seed: 19, gamesPerDiff: 10 });
    const equal = measureEqualTeamSimulation({ seed: 19, gamesPerDiff: 10 });

    expect(equal.configuration.ratingDifferences).toEqual([0]);
    expect(equal.ratingResults).toEqual([full.ratingResults[0]]);
    expect(equal.equalTeamMetrics).toEqual(full.equalTeamMetrics);
    expect(equal.calibration).toEqual(full.calibration);
    expect(equal.baselineApplied).toBe(false);
    expect(equal.violations).toEqual([]);
  });

  it('characterizes the accepted modern-FBS baseline', () => {
    const result = evaluateSimulation({ seed: 20260809, gamesPerDiff: 1000 });

    expect(result.checksum).toBe('1e97c7cf');
    expect(SIM_EVALUATION_BASELINE_CHECKSUM).toBe('1e97c7cf');
    const productionGaps = result.calibrationGaps.filter(gap => gap.startsWith('production.'));
    expect(productionGaps).toEqual([
      'production.madeFieldGoalsPerGame:low',
      'production.passingYardsPerAttempt:low',
      'production.passingYardsPerCompletion:low',
      'production.redZoneTouchdownRate:high',
      'production.turnoversPerGame:high',
    ]);
    expect(result.violations).toEqual([]);
    expect(result.calibration.benchmark.sourceChecksum).toBe('01fba155');
    expect(result.calibration.production.thirdDownAttemptsPerGame.target).toBe(26.971);
    expect(result.calibration.production.fourthDownAttemptsPerGame.target).toBe(3.872);
    expect(result.calibrationGaps).toEqual([...result.calibrationGaps].sort());
    expect(result.calibrationGaps).toContain('production.madeFieldGoalsPerGame:low');
    expect(result.calibrationGaps).toContain('production.redZoneTouchdownRate:high');
    expect(result.calibrationGaps).toContain('production.passingYardsPerAttempt:low');
    expect(result.equalTeamMetrics.scrimmagePlaysPerGame).toBeGreaterThan(0);
    expect(result.equalTeamMetrics.completionRate).toBeGreaterThan(0);
    expect(result.equalTeamMetrics.redZoneTripsPerGame).toBeGreaterThan(0);
    expect(result.equalTeamMetrics.threeAndOutsPerGame).toBeGreaterThan(0);
    expect(result.equalTeamMetrics.threeAndOutRate).toBeGreaterThan(0);
    expect(Object.values(result.equalTeamMetrics.driveEndings).reduce(
      (sum, ending) => sum + ending.share,
      0,
    )).toBeCloseTo(1);
    expect(result.equalTeamMetrics.fieldPosition).toEqual({
      minimum: 1,
      maximum: 99,
      invalidCount: 0,
    });
    expect(result.equalTeamMetrics.overtimeGameRate).toBeGreaterThan(0);
    expect(result.clockMetrics.twoMinuteTimeoutsPerGame).toBe(2);
    expect(result.clockMetrics.periodEventsPerGame).toEqual({
      endOfQuarter: 2,
      halftime: 1,
      endOfRegulation: 1,
    });
    expect(result.clockMetrics.regulationTimeOfPossessionSecondsPerGame).toBe(3600);
    expect(result.clockMetrics.runningAfterShare + result.clockMetrics.stoppedAfterShare).toBe(1);
    expect(result.conceptMetrics.quick_pass.completionRate).toBeGreaterThan(
      result.conceptMetrics.intermediate_pass.completionRate,
    );
    expect(result.conceptMetrics.intermediate_pass.completionRate).toBeGreaterThan(
      result.conceptMetrics.deep_pass.completionRate,
    );
    expect(result.conceptMetrics.deep_pass.explosiveRate).toBeGreaterThan(
      result.conceptMetrics.quick_pass.explosiveRate,
    );
    expect(result.conceptMetrics.outside_run.negativePlayRate).toBeGreaterThan(
      result.conceptMetrics.inside_run.negativePlayRate,
    );
    expect(result.defensiveMatchupMetrics.loaded_box.inside_run.yardsPerPlay).toBeLessThan(
      result.defensiveMatchupMetrics.base.inside_run.yardsPerPlay,
    );
    expect(result.defensiveMatchupMetrics.coverage.deep_pass.explosiveRate).toBeLessThan(
      result.defensiveMatchupMetrics.loaded_box.deep_pass.explosiveRate,
    );
    expect(result.defensiveMetrics.pressure.sackRate).toBeGreaterThan(
      result.defensiveMetrics.base.sackRate,
    );
    expect(result.tryMetrics.extraPoints.makeRate).toBeGreaterThanOrEqual(0.93);
    expect(result.tryMetrics.extraPoints.makeRate).toBeLessThanOrEqual(0.99);
    expect(result.tryMetrics.twoPoints.conversionRate).toBeGreaterThanOrEqual(0.35);
    expect(result.tryMetrics.twoPoints.conversionRate).toBeLessThanOrEqual(0.7);
    expect(result.tryMetrics.touchdownDrives.sixPoints).toBeGreaterThan(0);
    expect(result.tryMetrics.touchdownDrives.sevenPoints).toBeGreaterThan(0);
    expect(result.tryMetrics.touchdownDrives.eightPoints).toBeGreaterThan(0);
    expect(result.tryMetrics.automaticDecisionReasons.mandatorySecondOvertimeTwoPoint)
      .toBeGreaterThan(0);
    expect(result.tryMetrics.automaticDecisionReasons.shootoutTwoPoint).toBeGreaterThan(0);
  }, 15_000);
});
