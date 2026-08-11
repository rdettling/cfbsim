import type { Team } from '../../types/domain';
import type { DefensiveIntent } from '../../types/db';
import type { SimGame } from '../../types/sim';
import { HOME_FIELD_ADVANTAGE } from '../odds';
import { SIM_TUNING } from './config';
import type { PassConcept, RunConcept } from './concepts';
import { defensiveProfile } from './defensiveIntents';

export type SimOutcomeContext =
  | { kind: 'scrimmage'; down: 1 | 2 | 3 | 4 }
  | { kind: 'try' };

const gaussian = (mean: number, stdDev: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stdDev + mean;
};

const adjustedRatings = (offense: Team, defense: Team, game?: SimGame) => {
  let offenseRating = offense.offense;
  let defenseRating = defense.defense;
  if (game && !game.neutralSite && game.homeTeam) {
    if (game.homeTeam.id === offense.id) offenseRating += HOME_FIELD_ADVANTAGE;
    if (game.homeTeam.id === defense.id) defenseRating += HOME_FIELD_ADVANTAGE;
  }
  return { offenseRating, defenseRating };
};

const ratingMultiplier = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const ratingDiff = offenseRating - defenseRating;
  return 1 + (ratingDiff / SIM_TUNING.outcomes.yardsDiffDivisor);
};

const executionFactor = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const ratingDiff = offenseRating - defenseRating;
  return ratingDiff / SIM_TUNING.outcomes.executionDiffDivisor;
};

const passYards = (
  concept: PassConcept,
  intent: DefensiveIntent,
  fieldPosition: number,
  context: SimOutcomeContext,
  offense: Team,
  defense: Team,
  game?: SimGame,
) => {
  const profile = SIM_TUNING.concepts.pass[concept];
  const defenseProfile = defensiveProfile(intent, concept);
  const meanYardage = SIM_TUNING.outcomes.pass.baseMean
    * profile.meanMultiplier
    * defenseProfile.meanMultiplier;
  const rawYardage = gaussian(
    meanYardage,
    SIM_TUNING.outcomes.pass.stdDev
      * profile.stdDevMultiplier
      * defenseProfile.stdDevMultiplier,
  );
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + SIM_TUNING.outcomes.pass.positiveMultiplier
    * profile.positiveMultiplier
    * defenseProfile.positiveMultiplier
    * (rawYardage ** SIM_TUNING.outcomes.passPositivePower);
  const redZoneMultiplier = context.kind === 'scrimmage' && fieldPosition >= 80
    ? SIM_TUNING.outcomes.redZone.passPositiveYardsMultiplier
    : 1;
  const driveMultiplier = context.kind === 'scrimmage' && context.down === 3
    ? SIM_TUNING.outcomes.drive.thirdDownPositiveYardsMultiplier
    : 1;
  const ratingMult = ratingMultiplier(offense, defense, game);
  const adjusted = multiplied > 0
    ? multiplied * redZoneMultiplier * driveMultiplier * ratingMult
    : multiplied;
  return Math.min(Math.round(adjusted), 99);
};

const sackYards = () => Math.min(
  Math.round(gaussian(SIM_TUNING.outcomes.sack.baseMean, SIM_TUNING.outcomes.sack.stdDev)),
  0
);

const runYards = (
  concept: RunConcept,
  intent: DefensiveIntent,
  fieldPosition: number,
  context: SimOutcomeContext,
  offense: Team,
  defense: Team,
  game?: SimGame,
) => {
  const profile = SIM_TUNING.concepts.run[concept];
  const defenseProfile = defensiveProfile(intent, concept);
  const meanYardage = SIM_TUNING.outcomes.run.baseMean
    * profile.meanMultiplier
    * defenseProfile.meanMultiplier;
  const rawYardage = gaussian(
    meanYardage,
    SIM_TUNING.outcomes.run.stdDev
      * profile.stdDevMultiplier
      * defenseProfile.stdDevMultiplier,
  );
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + SIM_TUNING.outcomes.run.positiveMultiplier
    * profile.positiveMultiplier
    * defenseProfile.positiveMultiplier
    * (rawYardage ** SIM_TUNING.outcomes.runPositivePower);
  const redZoneMultiplier = context.kind === 'scrimmage' && fieldPosition >= 80
    ? SIM_TUNING.outcomes.redZone.runPositiveYardsMultiplier
    : 1;
  const driveMultiplier = context.kind === 'scrimmage' && context.down === 3
    ? SIM_TUNING.outcomes.drive.thirdDownPositiveYardsMultiplier
    : 1;
  const ratingMult = ratingMultiplier(offense, defense, game);
  const adjusted = multiplied > 0
    ? multiplied * redZoneMultiplier * driveMultiplier * ratingMult
    : multiplied;
  return Math.min(Math.round(adjusted), 99);
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const simPass = (
  concept: PassConcept,
  intent: DefensiveIntent,
  fieldPosition: number,
  context: SimOutcomeContext,
  offense: Team,
  defense: Team,
  game?: SimGame,
) => {
  const randSack = Math.random();
  const randCompletion = Math.random();
  const randInterception = Math.random();
  const result = { outcome: '', yards: 0 };

  const exec = executionFactor(offense, defense, game);
  const profile = SIM_TUNING.concepts.pass[concept];
  const defenseProfile = defensiveProfile(intent, concept);
  const sackRate = clamp(
    SIM_TUNING.outcomes.baseSackRate
      * (1 - exec)
      * profile.sackMultiplier
      * defenseProfile.sackMultiplier,
    0.005,
    0.2,
  );
  const compRate = clamp(
    SIM_TUNING.outcomes.baseCompPercent
      * (1 + exec)
      * profile.completionMultiplier
      * defenseProfile.completionMultiplier,
    0.25,
    0.9,
  );
  const intRate = clamp(
    SIM_TUNING.outcomes.baseIntRate
      * (1 - exec)
      * profile.interceptionMultiplier
      * defenseProfile.interceptionMultiplier,
    0.005,
    0.12,
  );

  if (randSack < sackRate) {
    result.outcome = 'sack';
    result.yards = sackYards();
  } else if (randCompletion < compRate) {
    result.yards = passYards(concept, intent, fieldPosition, context, offense, defense, game);
    if (result.yards + fieldPosition >= 100) {
      result.yards = 100 - fieldPosition;
      result.outcome = 'touchdown';
    } else {
      result.outcome = 'pass';
    }
  } else if (randInterception < intRate) {
    result.outcome = 'interception';
  } else {
    result.outcome = 'incomplete pass';
  }

  return result;
};

export const simRun = (
  concept: RunConcept,
  intent: DefensiveIntent,
  fieldPosition: number,
  context: SimOutcomeContext,
  offense: Team,
  defense: Team,
  game?: SimGame,
) => {
  const randFumble = Math.random();
  const result = { outcome: '', yards: 0 };
  const exec = executionFactor(offense, defense, game);
  const profile = SIM_TUNING.concepts.run[concept];
  const defenseProfile = defensiveProfile(intent, concept);
  const fumbleRate = clamp(
    SIM_TUNING.outcomes.baseFumbleRate
      * (1 - exec)
      * profile.fumbleMultiplier
      * defenseProfile.fumbleMultiplier,
    0.003,
    0.08,
  );
  if (randFumble < fumbleRate) {
    result.outcome = 'fumble';
  } else {
    result.yards = runYards(concept, intent, fieldPosition, context, offense, defense, game);
    if (result.yards + fieldPosition >= 100) {
      result.yards = 100 - fieldPosition;
      result.outcome = 'touchdown';
    } else {
      result.outcome = 'run';
    }
  }
  return result;
};

const interpolate = (
  value: number,
  startValue: number,
  endValue: number,
  startProbability: number,
  endProbability: number,
) => startProbability + (value - startValue) / (endValue - startValue)
  * (endProbability - startProbability);

export const fieldGoalProbability = (distance: number) => {
  const tuning = SIM_TUNING.outcomes.fieldGoal;
  let probability = tuning.shortProbability;
  if (distance > tuning.longDistance) {
    probability = interpolate(
      distance,
      tuning.longDistance,
      tuning.extremeDistance,
      tuning.longProbability,
      tuning.extremeProbability,
    );
  } else if (distance > tuning.mediumDistance) {
    probability = interpolate(
      distance,
      tuning.mediumDistance,
      tuning.longDistance,
      tuning.mediumProbability,
      tuning.longProbability,
    );
  } else if (distance > tuning.shortMaxDistance) {
    probability = interpolate(
      distance,
      tuning.shortMaxDistance,
      tuning.mediumDistance,
      tuning.shortProbability,
      tuning.mediumProbability,
    );
  }
  return clamp(
    probability * tuning.accuracyMultiplier,
    tuning.minimumProbability,
    1,
  );
};

export const fieldGoal = (fieldPosition: number) => {
  const distance = 100 - fieldPosition + 17;
  return Math.random() < fieldGoalProbability(distance);
};
