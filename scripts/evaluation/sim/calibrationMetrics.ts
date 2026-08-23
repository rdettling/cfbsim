import {
  SIM_CALIBRATION_BENCHMARK,
  type CalibrationTarget,
} from './calibrationBenchmark';

export type DistributionSummary = {
  mean: number;
  standardDeviation: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
};

export type RatingResult = {
  ratingDifference: number;
  teamARating: number;
  teamBRating: number;
  games: number;
  teamAWinRate: number;
  averageMargin: number;
  marginStandardDeviation: number;
  medianMargin: number;
  p90Margin: number;
  oneScoreRate: number;
  favoriteBlowoutRate: number;
  averageYardsA: number;
  averageYardsB: number;
  teamAProduction: RatingMatchupProduction;
  teamBProduction: RatingMatchupProduction;
  teamAScoring: DistributionSummary;
  teamBScoring: DistributionSummary;
};

export type RatingMatchupProduction = {
  yardsPerPlay: number;
  pointsPerDrive: number;
  completionRate: number;
  sackRate: number;
  turnoverRate: number;
  explosivePlayRate: number;
};

export type CalibrationStatus = 'aligned' | 'low' | 'high';

export type CalibrationMeasurement = {
  engineValue: number;
  target: number;
  absoluteDelta: number;
  relativeDelta: number;
  tolerance: CalibrationTarget['tolerance'];
  status: CalibrationStatus;
};

export type CalibrationSummary = {
  benchmark: Omit<typeof SIM_CALIBRATION_BENCHMARK, 'targets'>;
  production: Record<string, CalibrationMeasurement>;
  scoreDistribution: Record<string, CalibrationMeasurement>;
};

export type TuningScore = {
  gapCount: number;
  squaredExcess: number;
  normalizedDistance: number;
};

export const SIM_PRODUCTION_METRIC_KEYS = Object.keys(
  SIM_CALIBRATION_BENCHMARK.targets.production,
).sort();

export const SIM_RATING_PRESERVATION = [
  { ratingDifference: 0, winRate: 0.497, margin: null },
  { ratingDifference: 7, winRate: 0.667, margin: 6.62 },
  { ratingDifference: 14, winRate: 0.803, margin: 12.809 },
  { ratingDifference: 21, winRate: 0.906, margin: 19.742 },
] as const;
export const SIM_RATING_WIN_RATE_TOLERANCE = 0.04;
export const SIM_RATING_MARGIN_TOLERANCE = 2.5;

export const measureCalibration = (
  engineValue: number,
  benchmarkTarget: CalibrationTarget,
): CalibrationMeasurement => {
  const absoluteDelta = engineValue - benchmarkTarget.value;
  const relativeDelta = benchmarkTarget.value
    ? absoluteDelta / benchmarkTarget.value
    : 0;
  const allowedDelta = benchmarkTarget.tolerance.kind === 'relative'
    ? Math.abs(benchmarkTarget.value) * benchmarkTarget.tolerance.value
    : benchmarkTarget.tolerance.value;
  const status: CalibrationStatus = absoluteDelta < -allowedDelta
    ? 'low'
    : absoluteDelta > allowedDelta
      ? 'high'
      : 'aligned';
  return {
    engineValue,
    target: benchmarkTarget.value,
    absoluteDelta,
    relativeDelta,
    tolerance: benchmarkTarget.tolerance,
    status,
  };
};

export const calibrationAllowedDelta = (measurement: CalibrationMeasurement) => (
  measurement.tolerance.kind === 'relative'
    ? Math.abs(measurement.target) * measurement.tolerance.value
    : measurement.tolerance.value
);

const requireFinite = (label: string, values: number[]) => {
  if (values.some(value => !Number.isFinite(value))) {
    throw new Error(`${label} contains a non-finite value.`);
  }
};

export const validateProductionMeasurements = (
  label: string,
  production: Record<string, CalibrationMeasurement>,
) => {
  const keys = Object.keys(production).sort();
  if (keys.length !== SIM_PRODUCTION_METRIC_KEYS.length
    || keys.some((key, index) => key !== SIM_PRODUCTION_METRIC_KEYS[index])) {
    throw new Error(`${label} does not contain the exact production metric set.`);
  }
  for (const key of keys) {
    const measurement = production[key];
    requireFinite(`${label}.${key}`, [
      measurement.engineValue,
      measurement.target,
      measurement.absoluteDelta,
      measurement.relativeDelta,
    ]);
  }
};

export const poolProductionMeasurements = (
  samples: Array<Record<string, CalibrationMeasurement>>,
) => {
  if (!samples.length) throw new Error('Average production requires at least one sample.');
  samples.forEach((sample, index) => {
    validateProductionMeasurements(`Production sample ${index}`, sample);
  });
  return Object.fromEntries(SIM_PRODUCTION_METRIC_KEYS.map(key => {
    const average = samples.reduce(
      (total, sample) => total + sample[key].engineValue,
      0,
    ) / samples.length;
    return [key, measureCalibration(
      average,
      SIM_CALIBRATION_BENCHMARK.targets.production[key],
    )];
  }));
};

export const productionCalibrationGaps = (
  production: Record<string, CalibrationMeasurement>,
) => SIM_PRODUCTION_METRIC_KEYS
  .filter(key => production[key].status !== 'aligned')
  .map(key => `production.${key}:${production[key].status}`);

export const scoreProductionMeasurements = (
  production: Record<string, CalibrationMeasurement>,
): TuningScore => {
  const normalized = Object.values(production).map(measurement => (
    Math.abs(measurement.absoluteDelta) / calibrationAllowedDelta(measurement)
  ));
  return {
    gapCount: normalized.filter(value => value > 1).length,
    squaredExcess: normalized.reduce(
      (total, value) => total + Math.max(0, value - 1) ** 2,
      0,
    ),
    normalizedDistance: normalized.reduce((total, value) => total + value ** 2, 0)
      / normalized.length,
  };
};

export const compareTuningScores = (left: TuningScore, right: TuningScore) => {
  if (left.gapCount !== right.gapCount) return left.gapCount - right.gapCount;
  if (left.squaredExcess !== right.squaredExcess) {
    return left.squaredExcess - right.squaredExcess;
  }
  return left.normalizedDistance - right.normalizedDistance;
};

const inRange = (value: number, minimum: number, maximum: number) => (
  value >= minimum && value <= maximum
);

export const evaluateRatingPreservation = (ratingResults: RatingResult[]) => {
  const violations: string[] = [];
  for (const result of ratingResults) {
    const target = SIM_RATING_PRESERVATION.find(
      entry => entry.ratingDifference === result.ratingDifference,
    );
    if (!target) {
      violations.push(`Unknown rating difference ${result.ratingDifference}.`);
      continue;
    }
    const winRateRange: [number, number] = [
      target.winRate - SIM_RATING_WIN_RATE_TOLERANCE,
      target.winRate + SIM_RATING_WIN_RATE_TOLERANCE,
    ];
    if (!inRange(result.teamAWinRate, ...winRateRange)) {
      violations.push(
        `Rating difference ${result.ratingDifference} win rate ${result.teamAWinRate} is outside ${winRateRange[0]}-${winRateRange[1]}.`,
      );
    }
    if (target.margin !== null) {
      const marginRange: [number, number] = [
        target.margin - SIM_RATING_MARGIN_TOLERANCE,
        target.margin + SIM_RATING_MARGIN_TOLERANCE,
      ];
      if (!inRange(result.averageMargin, ...marginRange)) {
        violations.push(
          `Rating difference ${result.ratingDifference} margin ${result.averageMargin} is outside ${marginRange[0]}-${marginRange[1]}.`,
        );
      }
    }
  }
  for (let index = 1; index < ratingResults.length; index += 1) {
    if (ratingResults[index].teamAWinRate <= ratingResults[index - 1].teamAWinRate) {
      violations.push('Win rates are not strictly increasing by rating difference.');
      break;
    }
  }
  return violations;
};
