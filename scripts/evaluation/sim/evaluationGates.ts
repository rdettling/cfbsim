import { OFFENSIVE_CONCEPTS } from '../../../src/domain/sim/concepts';
import { DEFENSIVE_INTENTS } from '../../../src/domain/sim/defensiveIntents';
import type { DefensiveIntent } from '../../../src/types/db';
import {
  evaluateRatingPreservation,
  type RatingResult,
} from './calibrationMetrics';
import type { DefaultGateInput } from './evaluationAudit';

const finite = (value: number) => Number.isFinite(value);
const average = (value: number, count: number) => count ? value / count : 0;
const inRange = (value: number, minimum: number, maximum: number) => (
  finite(value) && value >= minimum && value <= maximum
);
const evaluateBalance = (
  ratingResults: RatingResult[],
  metrics: DefaultGateInput['equalTeamMetrics'],
) => {
  const violations = evaluateRatingPreservation(ratingResults);
  const gates: Array<[string, number, number, number]> = [
    ['resolved plays', metrics.resolvedPlaysPerGame, 140, 153],
    ['drives', metrics.drivesPerGame, 22, 27],
    ['field goal attempts', metrics.fieldGoalAttemptsPerGame, 2, 4],
    ['overtime rate', metrics.overtimeGameRate, 0.03, 0.09],
  ];
  for (const [label, value, minimum, maximum] of gates) {
    if (!inRange(value, minimum, maximum)) {
      violations.push(`${label} ${value} is outside ${minimum}-${maximum}.`);
    }
  }
  return violations;
};

const evaluateClockManagement = (metrics: DefaultGateInput['clockMetrics']) => {
  const violations: string[] = [];
  const tempo = metrics.management.tempo;
  if (Object.values(tempo).some(value => value.plays === 0)) {
    violations.push('Not every clock tempo appeared in the default audit.');
  }
  if (!(tempo.hurry_up.averageRunoffSeconds < tempo.normal.averageRunoffSeconds
    && tempo.normal.averageRunoffSeconds < tempo.chew_clock.averageRunoffSeconds)) {
    violations.push('Tempo runoff relationships are not ordered hurry, normal, chew.');
  }
  if (metrics.management.chargedTimeoutsPerGame <= 0) {
    violations.push('Automatic teams did not use charged timeouts.');
  }
  if (metrics.management.spikesPerGame <= 0 || metrics.management.kneelsPerGame <= 0) {
    violations.push('Every automatic clock-management action did not appear.');
  }
  return violations;
};

const evaluateTries = (metrics: DefaultGateInput['tryMetrics']) => {
  const violations: string[] = [];
  if (!inRange(metrics.extraPoints.makeRate, 0.93, 0.99)) {
    violations.push(
      `Extra-point make rate ${metrics.extraPoints.makeRate} is outside 0.93-0.99.`,
    );
  }
  if (!inRange(metrics.twoPoints.conversionRate, 0.35, 0.7)) {
    violations.push(
      `Two-point conversion rate ${metrics.twoPoints.conversionRate} is outside 0.35-0.70.`,
    );
  }
  if (metrics.extraPoints.attempts === 0 || metrics.twoPoints.attempts === 0) {
    violations.push('The default audit did not produce both extra-point and two-point attempts.');
  }
  return violations;
};

const evaluateConcepts = (metrics: DefaultGateInput['conceptMetrics']) => {
  const violations: string[] = [];
  const fail = (message: string) => violations.push(message);
  for (const concept of OFFENSIVE_CONCEPTS) {
    if (metrics[concept].calls === 0) fail(`Concept ${concept} was not called.`);
  }
  const quick = metrics.quick_pass;
  const intermediate = metrics.intermediate_pass;
  const deep = metrics.deep_pass;
  const screen = metrics.screen;
  const playAction = metrics.play_action;
  const inside = metrics.inside_run;
  const outside = metrics.outside_run;
  const option = metrics.option;
  if (!(quick.completionRate > intermediate.completionRate
    && intermediate.completionRate > deep.completionRate)) {
    fail('Pass-concept completion rates are not ordered quick > intermediate > deep.');
  }
  if (!(quick.sackRate < deep.sackRate && quick.sackRate < playAction.sackRate
    && screen.sackRate < deep.sackRate && screen.sackRate < playAction.sackRate)) {
    fail('Pass-concept sack rates do not reflect their intended risk profiles.');
  }
  if (!(deep.yardsPerCompletion > quick.yardsPerCompletion
    && deep.yardsPerCompletion > intermediate.yardsPerCompletion
    && deep.explosiveRate > quick.explosiveRate
    && deep.explosiveRate > intermediate.explosiveRate)) {
    fail('Deep passes are not more explosive than quick and intermediate passes.');
  }
  if (!(outside.explosiveRate > inside.explosiveRate
    && outside.negativePlayRate > inside.negativePlayRate)) {
    fail('Outside runs are not more volatile than inside runs.');
  }
  if (!(option.fumbleRate > inside.fumbleRate)) {
    fail('Option fumble rate does not exceed inside-run fumble rate.');
  }
  return violations;
};

const evaluateDefensiveIntents = (
  metrics: DefaultGateInput['defensiveMetrics'],
  matchups: DefaultGateInput['defensiveMatchupMetrics'],
) => {
  const violations: string[] = [];
  const fail = (message: string) => violations.push(message);
  for (const intent of DEFENSIVE_INTENTS) {
    if (metrics[intent].calls === 0) fail(`Defensive intent ${intent} was not called.`);
    for (const concept of OFFENSIVE_CONCEPTS) {
      if (matchups[intent][concept].calls === 0) {
        fail(`Defensive matchup ${intent}/${concept} was not called.`);
      }
    }
  }

  const loadedInside = matchups.loaded_box.inside_run;
  const baseInside = matchups.base.inside_run;
  const coverageInside = matchups.coverage.inside_run;
  if (!(loadedInside.yardsPerPlay < baseInside.yardsPerPlay
    && loadedInside.yardsPerPlay < coverageInside.yardsPerPlay
    && loadedInside.successRate < baseInside.successRate
    && loadedInside.successRate < coverageInside.successRate)) {
    fail('Loaded box does not suppress inside runs more than base and coverage.');
  }

  const coverageDeep = matchups.coverage.deep_pass;
  const baseDeep = matchups.base.deep_pass;
  const loadedDeep = matchups.loaded_box.deep_pass;
  if (!(coverageDeep.completionRate < baseDeep.completionRate
    && coverageDeep.completionRate < loadedDeep.completionRate
    && coverageDeep.explosiveRate < baseDeep.explosiveRate
    && coverageDeep.explosiveRate < loadedDeep.explosiveRate)) {
    fail('Coverage does not suppress deep passes more than base and loaded box.');
  }

  if (!(metrics.pressure.sackRate > metrics.base.sackRate
    && metrics.pressure.sackRate > metrics.coverage.sackRate)) {
    fail('Pressure does not create more sacks than base and coverage.');
  }
  if (!(metrics.pressure.yardsPerCompletion > metrics.base.yardsPerCompletion
    && metrics.pressure.completedPassExplosiveRate
      > metrics.base.completedPassExplosiveRate)) {
    fail('Completed plays against pressure are not more explosive than base.');
  }

  const pressure = matchups.pressure;
  if (!(pressure.quick_pass.sackRate < pressure.deep_pass.sackRate
    && pressure.quick_pass.sackRate < pressure.play_action.sackRate
    && pressure.screen.sackRate < pressure.deep_pass.sackRate
    && pressure.screen.sackRate < pressure.play_action.sackRate)) {
    fail('Quick passes and screens do not mitigate pressure sacks as intended.');
  }
  if (!(matchups.loaded_box.play_action.yardsPerPlay
    > matchups.coverage.play_action.yardsPerPlay)) {
    fail('Play action does not perform better against loaded box than coverage.');
  }

  const runYards = (intent: DefensiveIntent) => {
    const runs = ['inside_run', 'outside_run', 'option'] as const;
    const calls = runs.reduce((sum, concept) => sum + matchups[intent][concept].calls, 0);
    const yards = runs.reduce((sum, concept) => (
      sum + matchups[intent][concept].yardsPerPlay * matchups[intent][concept].calls
    ), 0);
    return average(yards, calls);
  };
  if (!(runYards('coverage') > runYards('loaded_box'))) {
    fail('Runs do not perform better against coverage than loaded box.');
  }
  return violations;
};

export const evaluateDefaultSimulationGates = (input: DefaultGateInput) => [
  ...evaluateBalance(input.ratingResults, input.equalTeamMetrics),
  ...evaluateConcepts(input.conceptMetrics),
  ...evaluateDefensiveIntents(
    input.defensiveMetrics,
    input.defensiveMatchupMetrics,
  ),
  ...evaluateClockManagement(input.clockMetrics),
  ...evaluateTries(input.tryMetrics),
];
