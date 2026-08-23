import { checksumValues } from '../shared/checksum';
import { parsePositiveInteger } from '../shared/cli';
import { createSeededRandom } from '../../../src/domain/utils/random';
import { SIM_CALIBRATION_BENCHMARK } from './calibrationBenchmark';
import {
  poolProductionMeasurements,
  productionCalibrationGaps,
  scoreProductionMeasurements,
  SIM_PRODUCTION_METRIC_KEYS,
  validateProductionMeasurements,
} from './calibrationMetrics';
import type { SimTuning } from '../../../src/domain/sim/config';
import { SIM_TUNING, withSimTuning } from '../../../src/domain/sim/config';
import {
  evaluateSimulation,
  measureEqualTeamSimulation,
} from './evaluation';
import type { SimulationEvaluationSummary } from './evaluationMetrics';
import {
  compareCalibrationGeneralization,
  compareSensitivityMeasurements,
  productionEngineValues,
  summarizeProductionStability,
  summarizeRatingStability,
} from './stabilityStatistics';
import {
  boundTuningParameter,
  findSimulationTuningCandidate,
  SIM_TUNING_PARAMETERS,
} from './tuner';

export type StabilityAuditOptions = {
  seed: number;
  searchGamesPerSeed: number;
  validationBlocks: number;
  gamesPerBlock: number;
  sensitivityGamesPerSeed: number;
};

type SeedFamilies = {
  search: number[];
  validation: number[];
  sensitivity: number[];
};

type EvaluationDependencies = {
  evaluateFull: typeof evaluateSimulation;
  evaluateEqual: typeof measureEqualTeamSimulation;
  findCandidate: typeof findSimulationTuningCandidate;
};

const DEFAULT_OPTIONS: StabilityAuditOptions = {
  seed: 20260809,
  searchGamesPerSeed: 200,
  validationBlocks: 5,
  gamesPerBlock: 1000,
  sensitivityGamesPerSeed: 200,
};
const SENSITIVITY_SEED_COUNT = 3;
const SENSITIVITY_STEP = 0.05;

export const parseStabilityAuditArguments = (arguments_: string[]): StabilityAuditOptions => {
  const options = { ...DEFAULT_OPTIONS };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--seed') options.seed = parsePositiveInteger(name, value);
    else if (name === '--search-games-per-seed') {
      options.searchGamesPerSeed = parsePositiveInteger(name, value);
    } else if (name === '--validation-blocks') {
      options.validationBlocks = parsePositiveInteger(name, value);
    } else if (name === '--games-per-block') {
      options.gamesPerBlock = parsePositiveInteger(name, value);
    } else if (name === '--sensitivity-games-per-seed') {
      options.sensitivityGamesPerSeed = parsePositiveInteger(name, value);
    } else throw new Error(`Unknown stability audit argument: ${name ?? '(missing)'}.`);
  }
  return options;
};

const derivedSeeds = (seed: number, role: string, count: number) => Array.from(
  { length: count },
  (_, index) => createSeededRandom(seed).fork(role).fork(index).int(1, 0x7fffffff),
);

export const deriveStabilityAuditSeeds = (
  options: StabilityAuditOptions,
): SeedFamilies => {
  const families = {
    search: [options.seed, options.seed + 1, options.seed + 2],
    validation: derivedSeeds(options.seed, 'sim-stability-validation', options.validationBlocks),
    sensitivity: derivedSeeds(options.seed, 'sim-stability-sensitivity', SENSITIVITY_SEED_COUNT),
  };
  const all = [...families.search, ...families.validation, ...families.sensitivity];
  if (all.some(seed => !Number.isSafeInteger(seed) || seed <= 0)) {
    throw new Error('Stability audit produced an invalid seed.');
  }
  if (new Set(all).size !== all.length) {
    throw new Error('Stability audit seed families overlap.');
  }
  return families;
};

const uniqueViolations = (summaries: SimulationEvaluationSummary[]) => [...new Set(
  summaries.flatMap(summary => summary.violations),
)].sort();

const evaluateValidationConfiguration = (
  tuning: SimTuning | null,
  seeds: number[],
  gamesPerBlock: number,
  evaluateFull: typeof evaluateSimulation,
) => {
  const run = () => seeds.map(seed => evaluateFull({ seed, gamesPerDiff: gamesPerBlock }));
  const summaries = tuning ? withSimTuning(tuning, run) : run();
  const production = summarizeProductionStability(
    summaries.map(summary => summary.calibration.production),
  );
  return {
    ...production,
    rating: summarizeRatingStability(summaries),
    blocks: summaries.map(summary => ({
      seed: summary.configuration.seed,
      production: productionEngineValues(summary.calibration.production),
      gaps: summary.calibrationGaps.filter(gap => gap.startsWith('production.')),
      ratingResults: summary.ratingResults.map(result => ({
        ratingDifference: result.ratingDifference,
        teamAWinRate: result.teamAWinRate,
        averageMargin: result.averageMargin,
      })),
      violations: summary.violations,
    })),
    violations: uniqueViolations(summaries),
  };
};

const evaluateProductionOnSeeds = (
  tuning: SimTuning,
  seeds: number[],
  gamesPerSeed: number,
  evaluateEqual: typeof measureEqualTeamSimulation,
) => withSimTuning(tuning, () => {
  const summaries = seeds.map(seed => evaluateEqual({ seed, gamesPerDiff: gamesPerSeed }));
  const production = poolProductionMeasurements(
    summaries.map(summary => summary.calibration.production),
  );
  return {
    production,
    score: scoreProductionMeasurements(production),
    gaps: productionCalibrationGaps(production),
    violations: uniqueViolations(summaries),
  };
});

export const buildSensitivityMatrix = (
  candidate: SimTuning,
  seeds: number[],
  gamesPerSeed: number,
  evaluateEqual: typeof measureEqualTeamSimulation,
) => {
  const baseline = evaluateProductionOnSeeds(candidate, seeds, gamesPerSeed, evaluateEqual);
  const replay = evaluateProductionOnSeeds(candidate, seeds, gamesPerSeed, evaluateEqual);
  const replayMatch = JSON.stringify(baseline) === JSON.stringify(replay);
  const violations = new Set([...baseline.violations, ...replay.violations]);
  const parameters = Object.fromEntries([...SIM_TUNING_PARAMETERS]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(parameter_ => {
      const currentValue = parameter_.read(candidate);
      const directions = Object.fromEntries(([-1, 1] as const).map(direction => {
        const requestedValue = currentValue * (1 + direction * SENSITIVITY_STEP);
        const actualValue = boundTuningParameter(requestedValue, parameter_);
        if (actualValue === currentValue) {
          return [direction < 0 ? 'lower' : 'higher', {
            requestedValue,
            actualValue,
            clamped: true,
            score: baseline.score,
            gaps: baseline.gaps,
            metrics: compareSensitivityMeasurements(
              baseline.production,
              baseline.production,
            ),
          }];
        }
        const variant = structuredClone(candidate);
        parameter_.write(variant, actualValue);
        const evaluation = evaluateProductionOnSeeds(
          variant,
          seeds,
          gamesPerSeed,
          evaluateEqual,
        );
        evaluation.violations.forEach(violation => violations.add(violation));
        return [direction < 0 ? 'lower' : 'higher', {
          requestedValue,
          actualValue,
          clamped: false,
          score: evaluation.score,
          gaps: evaluation.gaps,
          metrics: compareSensitivityMeasurements(
            baseline.production,
            evaluation.production,
          ),
        }];
      }));
      return [parameter_.key, {
        stage: parameter_.stage,
        currentValue,
        minimum: parameter_.minimum,
        maximum: parameter_.maximum,
        directions,
      }];
    }));
  return {
    baseline: {
      score: baseline.score,
      gaps: baseline.gaps,
      production: baseline.production,
    },
    replayMatch,
    stages: Object.fromEntries([...new Set(SIM_TUNING_PARAMETERS.map(
      parameter_ => parameter_.stage,
    ))].map(stage => [
      stage,
      SIM_TUNING_PARAMETERS
        .filter(parameter_ => parameter_.stage === stage)
        .map(parameter_ => parameter_.key)
        .sort(),
    ])),
    parameters,
    violations: [...violations].sort(),
  };
};

export const runCalibrationStabilityAudit = (
  options: StabilityAuditOptions,
  dependencies: Partial<EvaluationDependencies> = {},
) => {
  const resolved = {
    evaluateFull: dependencies.evaluateFull ?? evaluateSimulation,
    evaluateEqual: dependencies.evaluateEqual ?? measureEqualTeamSimulation,
    findCandidate: dependencies.findCandidate ?? findSimulationTuningCandidate,
  };
  const originalTuning = structuredClone(SIM_TUNING);
  const seeds = deriveStabilityAuditSeeds(options);
  const search = resolved.findCandidate({
    seed: options.seed,
    gamesPerSeed: options.searchGamesPerSeed,
  });
  validateProductionMeasurements('Tuner candidate', search.report.candidate.production);
  const baseline = evaluateValidationConfiguration(
    null,
    seeds.validation,
    options.gamesPerBlock,
    resolved.evaluateFull,
  );
  const candidate = evaluateValidationConfiguration(
    search.tuning,
    seeds.validation,
    options.gamesPerBlock,
    resolved.evaluateFull,
  );
  const sensitivity = buildSensitivityMatrix(
    search.tuning,
    seeds.sensitivity,
    options.sensitivityGamesPerSeed,
    resolved.evaluateEqual,
  );
  const leakedTuning = JSON.stringify(SIM_TUNING) !== JSON.stringify(originalTuning);
  const violations = [...new Set([
    ...baseline.violations,
    ...candidate.violations,
    ...sensitivity.violations,
    ...(!sensitivity.replayMatch ? ['Sensitivity replay was not deterministic.'] : []),
    ...(leakedTuning ? ['Stability audit leaked candidate tuning into runtime configuration.'] : []),
  ])].sort();
  const generalization = compareCalibrationGeneralization(
    search.report.candidate.gaps,
    candidate.gaps,
    candidate.rating.violations,
    violations,
  );
  const candidateParameters = Object.fromEntries([...SIM_TUNING_PARAMETERS]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(parameter_ => [parameter_.key, parameter_.read(search.tuning)]));
  const configuration = {
    ...options,
    sensitivitySeeds: SENSITIVITY_SEED_COUNT,
    sensitivityStep: SENSITIVITY_STEP,
    searchSeeds: seeds.search,
    validationSeeds: seeds.validation,
    sensitivitySeedValues: seeds.sensitivity,
  };
  const benchmark = {
    schemaVersion: SIM_CALIBRATION_BENCHMARK.schemaVersion,
    seasons: SIM_CALIBRATION_BENCHMARK.seasons,
    sourceChecksum: SIM_CALIBRATION_BENCHMARK.sourceChecksum,
    productionMetrics: SIM_PRODUCTION_METRIC_KEYS.length,
  };
  const recommendation = violations.length
    ? 'Resolve stability audit violations before interpreting calibration findings.'
    : generalization.wouldPassPooledAcceptance
      ? 'The candidate passes pooled held-out production and rating checks; review a pooled acceptance contract before adoption.'
      : generalization.lostAlignment.length
        ? 'The tuner candidate does not generalize cleanly; use the sensitivity matrix before changing controls or tolerances.'
        : 'The candidate remains outside pooled targets; use the sensitivity matrix to identify stable model conflicts.';
  const resultWithoutChecksum = {
    configuration,
    benchmark,
    search: search.report,
    candidateParameters,
    baseline,
    candidate,
    generalization,
    sensitivity,
    violations,
    recommendation,
  };
  return {
    ...resultWithoutChecksum,
    checksum: checksumValues([resultWithoutChecksum]),
  };
};

export const stabilityAuditExitCode = (result: { violations: string[] }) => (
  result.violations.length ? 1 : 0
);
