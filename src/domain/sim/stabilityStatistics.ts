import {
  calibrationAllowedDelta,
  evaluateRatingPreservation,
  poolProductionMeasurements,
  productionCalibrationGaps,
  scoreProductionMeasurements,
  SIM_PRODUCTION_METRIC_KEYS,
  SIM_RATING_MARGIN_TOLERANCE,
  SIM_RATING_PRESERVATION,
  SIM_RATING_WIN_RATE_TOLERANCE,
  validateProductionMeasurements,
  type CalibrationMeasurement,
  type RatingResult,
} from './calibrationMetrics';

export type StabilityClassification =
  | 'robustly_aligned'
  | 'boundary_sensitive'
  | 'clear_gap'
  | 'borderline_gap';

export type NumericSummary = {
  mean: number;
  sampleStandardDeviation: number;
  standardError: number;
  confidence95: { minimum: number; maximum: number };
  minimum: number;
  maximum: number;
};

type ProductionStabilityMetric = NumericSummary & {
  measurement: CalibrationMeasurement;
  toleranceRange: { minimum: number; maximum: number };
  alignedBlocks: number;
  blocks: number;
  classification: StabilityClassification;
};

const CONFIDENCE_Z = 1.96;

const requireFinite = (label: string, values: number[]) => {
  if (!values.length) throw new Error(`${label} requires at least one sample.`);
  if (values.some(value => !Number.isFinite(value))) {
    throw new Error(`${label} contains a non-finite value.`);
  }
};

export const summarizeNumericSamples = (values: number[]): NumericSummary => {
  requireFinite('Numeric summary', values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
    : 0;
  const sampleStandardDeviation = Math.sqrt(variance);
  const standardError = sampleStandardDeviation / Math.sqrt(values.length);
  return {
    mean,
    sampleStandardDeviation,
    standardError,
    confidence95: {
      minimum: mean - CONFIDENCE_Z * standardError,
      maximum: mean + CONFIDENCE_Z * standardError,
    },
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
};

const toleranceRange = (measurement: CalibrationMeasurement) => {
  const allowed = calibrationAllowedDelta(measurement);
  return { minimum: measurement.target - allowed, maximum: measurement.target + allowed };
};

export const classifyStability = (
  measurement: CalibrationMeasurement,
  confidence95: NumericSummary['confidence95'],
): StabilityClassification => {
  const range = toleranceRange(measurement);
  if (measurement.status === 'aligned') {
    return confidence95.minimum >= range.minimum && confidence95.maximum <= range.maximum
      ? 'robustly_aligned'
      : 'boundary_sensitive';
  }
  const entirelyOutside = measurement.status === 'low'
    ? confidence95.maximum < range.minimum
    : confidence95.minimum > range.maximum;
  return entirelyOutside ? 'clear_gap' : 'borderline_gap';
};

export const productionEngineValues = (
  production: Record<string, CalibrationMeasurement>,
) => Object.fromEntries(
  SIM_PRODUCTION_METRIC_KEYS.map(key => [key, production[key].engineValue]),
);

export const summarizeProductionStability = (
  samples: Array<Record<string, CalibrationMeasurement>>,
) => {
  if (!samples.length) throw new Error('Production stability requires at least one block.');
  samples.forEach((sample, index) => {
    validateProductionMeasurements(`Production block ${index}`, sample);
  });
  const pooled = poolProductionMeasurements(samples);
  const metrics = Object.fromEntries(SIM_PRODUCTION_METRIC_KEYS.map(key => {
    const numeric = summarizeNumericSamples(samples.map(sample => sample[key].engineValue));
    const measurement = pooled[key];
    const metric: ProductionStabilityMetric = {
      measurement,
      ...numeric,
      toleranceRange: toleranceRange(measurement),
      alignedBlocks: samples.filter(sample => sample[key].status === 'aligned').length,
      blocks: samples.length,
      classification: classifyStability(measurement, numeric.confidence95),
    };
    return [key, metric];
  }));
  return {
    score: scoreProductionMeasurements(pooled),
    gaps: productionCalibrationGaps(pooled),
    production: pooled,
    metrics,
  };
};

const summarizeRatingValue = (
  values: number[],
  target: number,
  tolerance: number,
) => {
  const summary = summarizeNumericSamples(values);
  const range = { minimum: target - tolerance, maximum: target + tolerance };
  return {
    target,
    tolerance,
    range,
    ...summary,
    alignedBlocks: values.filter(value => value >= range.minimum && value <= range.maximum).length,
  };
};

export const summarizeRatingStability = (
  blocks: Array<{ ratingResults: RatingResult[] }>,
) => {
  if (!blocks.length) throw new Error('Rating stability requires at least one block.');
  const pooledResults: RatingResult[] = [];
  const byDifference = Object.fromEntries(SIM_RATING_PRESERVATION.map(target => {
    const results = blocks.map(block => {
      const result = block.ratingResults.find(
        entry => entry.ratingDifference === target.ratingDifference,
      );
      if (!result) throw new Error(`Missing rating difference ${target.ratingDifference}.`);
      return result;
    });
    const winRate = summarizeRatingValue(
      results.map(result => result.teamAWinRate),
      target.winRate,
      SIM_RATING_WIN_RATE_TOLERANCE,
    );
    const margin = target.margin === null ? null : summarizeRatingValue(
      results.map(result => result.averageMargin),
      target.margin,
      SIM_RATING_MARGIN_TOLERANCE,
    );
    pooledResults.push({
      ...results[0],
      games: results.reduce((sum, result) => sum + result.games, 0),
      teamAWinRate: winRate.mean,
      averageMargin: margin?.mean ?? results.reduce(
        (sum, result) => sum + result.averageMargin,
        0,
      ) / results.length,
    });
    return [String(target.ratingDifference), { winRate, margin }];
  }));
  const violations = evaluateRatingPreservation(pooledResults);
  return {
    byDifference,
    pooledResults: pooledResults.map(result => ({
      ratingDifference: result.ratingDifference,
      games: result.games,
      teamAWinRate: result.teamAWinRate,
      averageMargin: result.averageMargin,
    })),
    strictlyIncreasing: pooledResults.every((result, index) => (
      index === 0 || result.teamAWinRate > pooledResults[index - 1].teamAWinRate
    )),
    violations,
  };
};

const targetDistance = (measurement: CalibrationMeasurement) => (
  Math.abs(measurement.absoluteDelta) / calibrationAllowedDelta(measurement)
);

export const compareSensitivityMeasurements = (
  baseline: Record<string, CalibrationMeasurement>,
  variant: Record<string, CalibrationMeasurement>,
) => Object.fromEntries(SIM_PRODUCTION_METRIC_KEYS.map(key => {
  const engineDelta = variant[key].engineValue - baseline[key].engineValue;
  const distanceBefore = targetDistance(baseline[key]);
  const distanceAfter = targetDistance(variant[key]);
  return [key, {
    engineValue: variant[key].engineValue,
    engineDelta,
    toleranceDelta: engineDelta / calibrationAllowedDelta(baseline[key]),
    normalizedTargetDistanceBefore: distanceBefore,
    normalizedTargetDistanceAfter: distanceAfter,
    direction: distanceAfter < distanceBefore
      ? 'improved'
      : distanceAfter > distanceBefore
        ? 'worsened'
        : 'unchanged',
  }];
}));

const gapKeys = (gaps: string[]) => new Set(gaps.map(gap => gap.split(':')[0]));

export const compareCalibrationGeneralization = (
  trainingGaps: string[],
  validationGaps: string[],
  ratingViolations: string[],
  auditViolations: string[],
) => {
  const trainingKeys = gapKeys(trainingGaps);
  const validationKeys = gapKeys(validationGaps);
  return {
    trainingGapCount: trainingGaps.length,
    validationGapCount: validationGaps.length,
    gapCountDelta: validationGaps.length - trainingGaps.length,
    lostAlignment: [...validationKeys].filter(key => !trainingKeys.has(key)).sort(),
    gainedAlignment: [...trainingKeys].filter(key => !validationKeys.has(key)).sort(),
    wouldPassPooledAcceptance: !validationGaps.length
      && !ratingViolations.length
      && !auditViolations.length,
  };
};
