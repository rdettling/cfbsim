import type { CalibrationMeasurement } from './calibrationMetrics';

export const CALIBRATION_STAGES = [
  'pace',
  'play_mix',
  'base_efficiency',
  'explosiveness',
  'turnovers',
  'downs',
  'finishing',
  'kicking',
  'score_distribution',
] as const;

export type CalibrationStage = typeof CALIBRATION_STAGES[number];

export const PRODUCTION_METRIC_STAGES: Record<string, CalibrationStage> = {
  scrimmagePlaysPerGame: 'pace',
  offensiveYardsPerGame: 'base_efficiency',
  yardsPerPlay: 'base_efficiency',
  touchdownsPerGame: 'finishing',
  puntsPerGame: 'downs',
  madeFieldGoalsPerGame: 'kicking',
  fieldGoalMakeRate: 'kicking',
  turnoversPerGame: 'turnovers',
  fumblesLostPerGame: 'turnovers',
  passPlayShare: 'play_mix',
  completionRate: 'base_efficiency',
  sackRate: 'base_efficiency',
  interceptionRate: 'turnovers',
  rushingYardsPerAttempt: 'base_efficiency',
  passingYardsPerAttempt: 'base_efficiency',
  passingYardsPerCompletion: 'explosiveness',
  thirdDownAttemptsPerGame: 'downs',
  thirdDownConversionRate: 'downs',
  fourthDownAttemptsPerGame: 'downs',
  fourthDownConversionRate: 'downs',
  redZoneScoringRate: 'finishing',
  redZoneTouchdownRate: 'finishing',
};

export const groupCalibrationMeasurements = (
  production: Record<string, CalibrationMeasurement>,
  scoreDistribution: Record<string, CalibrationMeasurement>,
) => Object.fromEntries(CALIBRATION_STAGES.map(stage => [
  stage,
  stage === 'score_distribution'
    ? scoreDistribution
    : Object.fromEntries(Object.entries(production)
      .filter(([key]) => PRODUCTION_METRIC_STAGES[key] === stage)),
]));
