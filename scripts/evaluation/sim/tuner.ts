import type { SimTuning } from '../../../src/domain/sim/config';
import { SIM_TUNING, withSimTuning } from '../../../src/domain/sim/config';
import {
  compareTuningScores,
  poolProductionMeasurements,
  productionCalibrationGaps,
  scoreProductionMeasurements,
  type CalibrationMeasurement,
  type TuningScore,
} from './calibrationMetrics';
import { measureEqualTeamSimulation } from './evaluation';
import { parsePositiveInteger } from '../shared/cli';

export type SimulationTuningOptions = {
  seed: number;
  gamesPerSeed: number;
};

export type TuningCandidateEvaluation = {
  score: TuningScore;
  production: Record<string, CalibrationMeasurement>;
  gaps: string[];
  violations: string[];
};

export type TunableParameter = {
  key: string;
  minimum: number;
  maximum: number;
  read: (tuning: SimTuning) => number;
  write: (tuning: SimTuning, value: number) => void;
};

const parameter = (
  key: string,
  minimum: number,
  maximum: number,
  read: TunableParameter['read'],
  write: TunableParameter['write'],
): TunableParameter => ({ key, minimum, maximum, read, write });

export const SIM_TUNING_PARAMETERS: readonly TunableParameter[] = [
  parameter('playcalling.passWeightBase', 0.4, 0.55,
    tuning => tuning.playcalling.passWeightBase,
    (tuning, value) => { tuning.playcalling.passWeightBase = value; }),
  parameter('outcomes.baseCompPercent', 0.55, 0.7,
    tuning => tuning.outcomes.baseCompPercent,
    (tuning, value) => { tuning.outcomes.baseCompPercent = value; }),
  parameter('outcomes.baseSackRate', 0.03, 0.1,
    tuning => tuning.outcomes.baseSackRate,
    (tuning, value) => { tuning.outcomes.baseSackRate = value; }),
  parameter('outcomes.baseIntRate', 0.02, 0.12,
    tuning => tuning.outcomes.baseIntRate,
    (tuning, value) => { tuning.outcomes.baseIntRate = value; }),
  parameter('outcomes.baseFumbleRate', 0.005, 0.03,
    tuning => tuning.outcomes.baseFumbleRate,
    (tuning, value) => { tuning.outcomes.baseFumbleRate = value; }),
  parameter('outcomes.run.baseMean', 3, 6,
    tuning => tuning.outcomes.run.baseMean,
    (tuning, value) => { tuning.outcomes.run.baseMean = value; }),
  parameter('outcomes.run.positiveMultiplier', 0.00005, 0.002,
    tuning => tuning.outcomes.run.positiveMultiplier,
    (tuning, value) => { tuning.outcomes.run.positiveMultiplier = value; }),
  parameter('outcomes.pass.baseMean', 5, 10,
    tuning => tuning.outcomes.pass.baseMean,
    (tuning, value) => { tuning.outcomes.pass.baseMean = value; }),
  parameter('outcomes.pass.positiveMultiplier', 0.0005, 0.01,
    tuning => tuning.outcomes.pass.positiveMultiplier,
    (tuning, value) => { tuning.outcomes.pass.positiveMultiplier = value; }),
  parameter('outcomes.redZone.runPositiveYardsMultiplier', 0.6, 1.05,
    tuning => tuning.outcomes.redZone.runPositiveYardsMultiplier,
    (tuning, value) => { tuning.outcomes.redZone.runPositiveYardsMultiplier = value; }),
  parameter('outcomes.redZone.passPositiveYardsMultiplier', 0.6, 1.05,
    tuning => tuning.outcomes.redZone.passPositiveYardsMultiplier,
    (tuning, value) => { tuning.outcomes.redZone.passPositiveYardsMultiplier = value; }),
  parameter('outcomes.drive.thirdDownPositiveYardsMultiplier', 0.9, 1.25,
    tuning => tuning.outcomes.drive.thirdDownPositiveYardsMultiplier,
    (tuning, value) => { tuning.outcomes.drive.thirdDownPositiveYardsMultiplier = value; }),
  parameter('outcomes.fieldGoal.accuracyMultiplier', 0.85, 1.15,
    tuning => tuning.outcomes.fieldGoal.accuracyMultiplier,
    (tuning, value) => { tuning.outcomes.fieldGoal.accuracyMultiplier = value; }),
];

export const SIM_TUNING_STEPS = [0.2, 0.1, 0.05, 0.025] as const;

export const parseSimulationTuningArguments = (
  arguments_: string[],
): SimulationTuningOptions => {
  const options: SimulationTuningOptions = { seed: 20260809, gamesPerSeed: 200 };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--seed') options.seed = parsePositiveInteger(name, value);
    else if (name === '--games-per-seed') {
      options.gamesPerSeed = parsePositiveInteger(name, value);
    } else throw new Error(`Unknown simulation tuning argument: ${name ?? '(missing)'}.`);
  }
  return options;
};

export const evaluateTuningCandidate = (
  tuning: SimTuning,
  options: SimulationTuningOptions,
): TuningCandidateEvaluation => withSimTuning(tuning, () => {
  const summaries = [0, 1, 2].map(offset => measureEqualTeamSimulation({
    seed: options.seed + offset,
    gamesPerDiff: options.gamesPerSeed,
  }));
  const production = poolProductionMeasurements(
    summaries.map(summary => summary.calibration.production),
  );
  const violations = [...new Set(summaries.flatMap(summary => summary.violations))].sort();
  const gaps = productionCalibrationGaps(production);
  return {
    score: scoreProductionMeasurements(production),
    production,
    gaps,
    violations,
  };
});

export const boundTuningParameter = (value: number, parameter_: TunableParameter) => Math.min(
  parameter_.maximum,
  Math.max(parameter_.minimum, value),
);

const scaleTowardTarget = (
  tuning: SimTuning,
  parameterKey: string,
  measurement: CalibrationMeasurement,
) => {
  const parameter_ = SIM_TUNING_PARAMETERS.find(value => value.key === parameterKey)!;
  if (!measurement.engineValue) return;
  parameter_.write(
    tuning,
    boundTuningParameter(
      parameter_.read(tuning) * measurement.target / measurement.engineValue,
      parameter_,
    ),
  );
};

export const buildCausalTuningCandidate = (
  baseline: SimTuning,
  production: Record<string, CalibrationMeasurement>,
) => {
  const candidate = structuredClone(baseline);
  scaleTowardTarget(candidate, 'playcalling.passWeightBase', production.passPlayShare);
  scaleTowardTarget(candidate, 'outcomes.baseCompPercent', production.completionRate);
  scaleTowardTarget(candidate, 'outcomes.baseSackRate', production.sackRate);
  scaleTowardTarget(candidate, 'outcomes.baseIntRate', production.interceptionRate);
  scaleTowardTarget(candidate, 'outcomes.baseFumbleRate', production.fumblesLostPerGame);
  scaleTowardTarget(candidate, 'outcomes.run.baseMean', production.rushingYardsPerAttempt);
  scaleTowardTarget(
    candidate,
    'outcomes.pass.baseMean',
    production.passingYardsPerCompletion,
  );
  scaleTowardTarget(
    candidate,
    'outcomes.redZone.runPositiveYardsMultiplier',
    production.redZoneTouchdownRate,
  );
  scaleTowardTarget(
    candidate,
    'outcomes.redZone.passPositiveYardsMultiplier',
    production.redZoneTouchdownRate,
  );
  scaleTowardTarget(
    candidate,
    'outcomes.fieldGoal.accuracyMultiplier',
    production.fieldGoalMakeRate,
  );
  scaleTowardTarget(
    candidate,
    'outcomes.drive.thirdDownPositiveYardsMultiplier',
    production.thirdDownConversionRate,
  );
  return candidate;
};

export const buildDriveConsistencyTuningCandidate = (causal: SimTuning) => {
  const candidate = structuredClone(causal);
  const setScaled = (key: string, factor: number) => {
    const parameter_ = SIM_TUNING_PARAMETERS.find(value => value.key === key)!;
    parameter_.write(
      candidate,
      boundTuningParameter(parameter_.read(candidate) * factor, parameter_),
    );
  };
  setScaled('outcomes.pass.baseMean', 1.25);
  setScaled('outcomes.pass.positiveMultiplier', 0.25);
  setScaled('outcomes.run.baseMean', 1.1);
  setScaled('outcomes.run.positiveMultiplier', 0.5);
  setScaled('outcomes.redZone.runPositiveYardsMultiplier', 0.8);
  setScaled('outcomes.redZone.passPositiveYardsMultiplier', 0.8);
  setScaled('outcomes.drive.thirdDownPositiveYardsMultiplier', 0.85);
  return candidate;
};

export const findSimulationTuningCandidate = (
  options: SimulationTuningOptions,
  evaluate: (
    tuning: SimTuning,
    options: SimulationTuningOptions,
  ) => TuningCandidateEvaluation = evaluateTuningCandidate,
) => {
  const baselineTuning = structuredClone(SIM_TUNING);
  const baseline = evaluate(baselineTuning, options);
  let evaluations = 1;

  const causalTuning = buildCausalTuningCandidate(baselineTuning, baseline.production);
  const causalEvaluation = evaluate(causalTuning, options);
  evaluations += 1;
  const ordinaryStart = !causalEvaluation.violations.length
    && compareTuningScores(causalEvaluation.score, baseline.score) < 0
    ? { tuning: causalTuning, evaluation: causalEvaluation }
    : { tuning: structuredClone(baselineTuning), evaluation: baseline };
  const driveTuning = buildDriveConsistencyTuningCandidate(causalTuning);
  const driveEvaluation = evaluate(driveTuning, options);
  evaluations += 1;

  const refine = (start: {
    tuning: SimTuning;
    evaluation: TuningCandidateEvaluation;
  }) => {
    let tuning = structuredClone(start.tuning);
    let evaluation = start.evaluation;
    for (const step of SIM_TUNING_STEPS) {
      for (let sweep = 0; sweep < 20; sweep += 1) {
        let improved = false;
        for (const parameter_ of SIM_TUNING_PARAMETERS) {
          const currentValue = parameter_.read(tuning);
          for (const direction of [-1, 1]) {
            const candidate = structuredClone(tuning);
            parameter_.write(
              candidate,
              boundTuningParameter(currentValue * (1 + direction * step), parameter_),
            );
            const candidateEvaluation = evaluate(candidate, options);
            evaluations += 1;
            if (!candidateEvaluation.violations.length
              && compareTuningScores(candidateEvaluation.score, evaluation.score) < 0) {
              tuning = candidate;
              evaluation = candidateEvaluation;
              improved = true;
            }
          }
        }
        if (!improved) break;
      }
    }
    return { tuning, evaluation };
  };

  const refined = [
    refine(ordinaryStart),
    refine({ tuning: driveTuning, evaluation: driveEvaluation }),
  ].sort((left, right) => compareTuningScores(left.evaluation.score, right.evaluation.score));
  const { tuning, evaluation } = refined[0];

  const changedParameters = Object.fromEntries(SIM_TUNING_PARAMETERS
    .map(parameter_ => [
      parameter_.key,
      {
        before: parameter_.read(baselineTuning),
        after: parameter_.read(tuning),
      },
    ] as const)
    .filter(([, values]) => values.before !== values.after));

  const report = {
    configuration: {
      ...options,
      seeds: [options.seed, options.seed + 1, options.seed + 2],
      steps: SIM_TUNING_STEPS,
      parameters: SIM_TUNING_PARAMETERS.map(parameter_ => parameter_.key),
      evaluations,
    },
    baseline: {
      score: baseline.score,
      production: baseline.production,
      gaps: baseline.gaps,
      violations: baseline.violations,
    },
    candidate: {
      score: evaluation.score,
      changedParameters,
      production: evaluation.production,
      gaps: evaluation.gaps,
      violations: evaluation.violations,
    },
    recommendation: evaluation.gaps.length
      ? 'Review remaining production gaps before adopting this candidate.'
      : 'Apply the exact candidate values, then run the full default audit.',
  };
  return { report, tuning };
};

export const searchSimulationTuning = (
  options: SimulationTuningOptions,
  evaluate: (
    tuning: SimTuning,
    options: SimulationTuningOptions,
  ) => TuningCandidateEvaluation = evaluateTuningCandidate,
) => findSimulationTuningCandidate(options, evaluate).report;
