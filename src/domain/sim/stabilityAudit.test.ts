import { describe, expect, it, vi } from 'vitest';
import { SIM_CALIBRATION_BENCHMARK } from './calibrationBenchmark';
import {
  measureCalibration,
  SIM_RATING_PRESERVATION,
  type RatingResult,
} from './calibrationMetrics';
import { SIM_TUNING } from './config';
import {
  type SimulationEvaluationSummary,
} from './evaluation';
import {
  buildSensitivityMatrix,
  deriveStabilityAuditSeeds,
  parseStabilityAuditArguments,
  runCalibrationStabilityAudit,
} from './stabilityAudit';
import {
  classifyStability,
  compareCalibrationGeneralization,
  summarizeNumericSamples,
  summarizeProductionStability,
  summarizeRatingStability,
} from './stabilityStatistics';

const productionAtTargets = () => Object.fromEntries(
  Object.entries(SIM_CALIBRATION_BENCHMARK.targets.production).map(([key, target]) => [
    key,
    measureCalibration(target.value, target),
  ]),
);

const ratingResult = (
  ratingDifference: number,
  teamAWinRate: number,
  averageMargin: number,
): RatingResult => ({
  ratingDifference,
  games: 10,
  teamAWinRate,
  averageMargin,
  marginStandardDeviation: 0,
  medianMargin: averageMargin,
  p90Margin: averageMargin,
  oneScoreRate: 0,
  favoriteBlowoutRate: 0,
  averageYardsA: 0,
  averageYardsB: 0,
  teamAScoring: {
    mean: 0,
    standardDeviation: 0,
    p10: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    p90: 0,
    p95: 0,
  },
  teamBScoring: {
    mean: 0,
    standardDeviation: 0,
    p10: 0,
    p25: 0,
    p50: 0,
    p75: 0,
    p90: 0,
    p95: 0,
  },
});

const ratingBlock = (offset = 0) => ({
  ratingResults: SIM_RATING_PRESERVATION.map(target => ratingResult(
    target.ratingDifference,
    target.winRate + offset,
    (target.margin ?? 0) + offset,
  )),
}) as unknown as SimulationEvaluationSummary;

describe('simulation calibration stability audit', () => {
  it('parses defaults, overrides, and malformed arguments', () => {
    expect(parseStabilityAuditArguments([])).toEqual({
      seed: 20260809,
      searchGamesPerSeed: 200,
      validationBlocks: 5,
      gamesPerBlock: 1000,
      sensitivityGamesPerSeed: 200,
    });
    expect(parseStabilityAuditArguments([
      '--seed', '7',
      '--search-games-per-seed', '8',
      '--validation-blocks', '3',
      '--games-per-block', '9',
      '--sensitivity-games-per-seed', '10',
    ])).toEqual({
      seed: 7,
      searchGamesPerSeed: 8,
      validationBlocks: 3,
      gamesPerBlock: 9,
      sensitivityGamesPerSeed: 10,
    });
    expect(() => parseStabilityAuditArguments(['--blocks', '2'])).toThrow('Unknown');
    expect(() => parseStabilityAuditArguments(['--validation-blocks', '0']))
      .toThrow('positive integer');
    expect(() => parseStabilityAuditArguments(['--seed']))
      .toThrow('positive integer');
  });

  it('derives deterministic disjoint seed families', () => {
    const options = parseStabilityAuditArguments(['--seed', '123']);
    const first = deriveStabilityAuditSeeds(options);
    const second = deriveStabilityAuditSeeds(options);
    const all = [...first.search, ...first.validation, ...first.sensitivity];

    expect(first).toEqual(second);
    expect(first.search).toEqual([123, 124, 125]);
    expect(first.validation).toHaveLength(5);
    expect(first.sensitivity).toHaveLength(3);
    expect(new Set(all).size).toBe(all.length);
  });

  it('summarizes sample variation and rejects unusable samples', () => {
    const summary = summarizeNumericSamples([1, 2, 3]);
    expect(summary.mean).toBe(2);
    expect(summary.sampleStandardDeviation).toBe(1);
    expect(summary.standardError).toBeCloseTo(1 / Math.sqrt(3));
    expect(summary.confidence95.minimum).toBeCloseTo(2 - 1.96 / Math.sqrt(3));
    expect(summary.minimum).toBe(1);
    expect(summary.maximum).toBe(3);
    expect(() => summarizeNumericSamples([])).toThrow('at least one sample');
    expect(() => summarizeNumericSamples([Number.NaN])).toThrow('non-finite');
  });

  it('classifies robust, boundary-sensitive, clear, and borderline results', () => {
    const target = SIM_CALIBRATION_BENCHMARK.targets.production.passPlayShare;
    const aligned = measureCalibration(target.value, target);
    const nearEdge = measureCalibration(target.value + 0.019, target);
    const low = measureCalibration(target.value - 0.03, target);

    expect(classifyStability(aligned, {
      minimum: target.value - 0.01,
      maximum: target.value + 0.01,
    })).toBe('robustly_aligned');
    expect(classifyStability(nearEdge, {
      minimum: target.value + 0.017,
      maximum: target.value + 0.021,
    })).toBe('boundary_sensitive');
    expect(classifyStability(low, {
      minimum: target.value - 0.035,
      maximum: target.value - 0.025,
    })).toBe('clear_gap');
    expect(classifyStability(low, {
      minimum: target.value - 0.035,
      maximum: target.value - 0.015,
    })).toBe('borderline_gap');
  });

  it('pools exact production metrics and tracks aligned blocks', () => {
    const first = productionAtTargets();
    const second = productionAtTargets();
    const target = SIM_CALIBRATION_BENCHMARK.targets.production.puntsPerGame;
    second.puntsPerGame = measureCalibration(target.value * 1.2, target);
    const result = summarizeProductionStability([first, second]);

    expect(result.production.puntsPerGame.engineValue).toBeCloseTo(target.value * 1.1);
    expect(result.metrics.puntsPerGame.alignedBlocks).toBe(1);
    expect(Object.keys(result.production)).toHaveLength(22);

    const incomplete = { ...first };
    delete incomplete.puntsPerGame;
    expect(() => summarizeProductionStability([incomplete]))
      .toThrow('exact production metric set');
    const nonFinite = productionAtTargets();
    nonFinite.puntsPerGame = { ...nonFinite.puntsPerGame, engineValue: Number.NaN };
    expect(() => summarizeProductionStability([nonFinite])).toThrow('non-finite');
  });

  it('aggregates rating preservation and detects non-monotonic curves', () => {
    const stable = summarizeRatingStability([ratingBlock(-0.005), ratingBlock(0.005)]);
    expect(stable.violations).toEqual([]);
    expect(stable.strictlyIncreasing).toBe(true);
    expect(stable.byDifference['21'].winRate.mean).toBeCloseTo(0.906);

    const malformed = ratingBlock();
    malformed.ratingResults[2].teamAWinRate = malformed.ratingResults[1].teamAWinRate;
    const unstable = summarizeRatingStability([malformed]);
    expect(unstable.strictlyIncreasing).toBe(false);
    expect(unstable.violations).toContain('Win rates are not strictly increasing by rating difference.');
  });

  it('reports gained and lost alignment without changing acceptance', () => {
    expect(compareCalibrationGeneralization(
      ['production.puntsPerGame:high'],
      ['production.turnoversPerGame:low'],
      [],
      [],
    )).toEqual({
      trainingGapCount: 1,
      validationGapCount: 1,
      gapCountDelta: 0,
      lostAlignment: ['production.turnoversPerGame'],
      gainedAlignment: ['production.puntsPerGame'],
      wouldPassPooledAcceptance: false,
    });
    expect(compareCalibrationGeneralization([], [], [], []).wouldPassPooledAcceptance)
      .toBe(true);
  });

  it('uses shared sensitivity seeds and identifies a clamped direction', () => {
    const candidate = structuredClone(SIM_TUNING);
    candidate.outcomes.pass.baseMean = 10;
    const calls: number[] = [];
    const evaluateEqual = vi.fn((options: { seed: number; gamesPerDiff: number }) => {
      calls.push(options.seed);
      const production = productionAtTargets();
      const target = SIM_CALIBRATION_BENCHMARK.targets.production.completionRate;
      production.completionRate = measureCalibration(
        SIM_TUNING.outcomes.baseCompPercent,
        target,
      );
      return {
        calibration: { production },
        violations: [],
      } as unknown as SimulationEvaluationSummary;
    });
    const seeds = [101, 102, 103];
    const result = buildSensitivityMatrix(candidate, seeds, 2, evaluateEqual);

    expect(result.replayMatch).toBe(true);
    expect(result.parameters['outcomes.pass.baseMean'].directions.higher.clamped).toBe(true);
    expect(result.parameters['outcomes.baseCompPercent'].directions.higher
      .metrics.completionRate.direction).toBe('worsened');
    for (let index = 0; index < calls.length; index += seeds.length) {
      expect(calls.slice(index, index + seeds.length)).toEqual(seeds);
    }
  });

  it('restores tuning when sensitivity evaluation throws', () => {
    const original = structuredClone(SIM_TUNING);
    const candidate = structuredClone(SIM_TUNING);
    candidate.outcomes.baseCompPercent = 0.7;

    expect(() => buildSensitivityMatrix(
      candidate,
      [101],
      1,
      (() => {
        throw new Error('evaluation failed');
      }) as typeof import('./evaluation').measureEqualTeamSimulation,
    )).toThrow('evaluation failed');
    expect(SIM_TUNING).toEqual(original);
  });

  it('is deterministic and restores tuning in a reduced real audit', () => {
    const original = structuredClone(SIM_TUNING);
    const options = parseStabilityAuditArguments([
      '--seed', '903',
      '--search-games-per-seed', '1',
      '--validation-blocks', '1',
      '--games-per-block', '1',
      '--sensitivity-games-per-seed', '1',
    ]);
    const first = runCalibrationStabilityAudit(options);
    const second = runCalibrationStabilityAudit(options);

    expect(second).toEqual(first);
    expect(first.sensitivity.replayMatch).toBe(true);
    expect(SIM_TUNING).toEqual(original);
  }, 30_000);
});
