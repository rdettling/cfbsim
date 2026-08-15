import type { DefensiveIntent, OffensiveConcept } from '../../types/db';
import type { PlaySituation } from '../../types/sim';
import { createSeededRandom } from '../utils/random';
import { SIM_TUNING } from './config';

export const DEFENSIVE_INTENTS = [
  'base',
  'loaded_box',
  'coverage',
  'pressure',
] as const;

export const DEFENSIVE_INTENT_LABELS: Record<DefensiveIntent, string> = {
  base: 'Base',
  loaded_box: 'Loaded Box',
  coverage: 'Coverage',
  pressure: 'Pressure',
};

export const isDefensiveIntent = (value: unknown): value is DefensiveIntent =>
  typeof value === 'string'
  && DEFENSIVE_INTENTS.includes(value as DefensiveIntent);

const multiply = (
  weights: Record<DefensiveIntent, number>,
  adjustment: Partial<Record<DefensiveIntent, number>>,
) => {
  for (const intent of DEFENSIVE_INTENTS) {
    weights[intent] *= adjustment[intent] ?? 1;
  }
};

export const defensiveIntentWeights = (
  situation: PlaySituation,
): Record<DefensiveIntent, number> => {
  const weights = { ...SIM_TUNING.defense.automatic.base };
  const adjustments = SIM_TUNING.defense.automatic.adjustments;
  if (situation.yardsLeft <= 3) multiply(weights, adjustments.shortYardage);
  if (situation.yardsLeft >= 7) multiply(weights, adjustments.longYardage);
  if (situation.fieldPosition >= 80) multiply(weights, adjustments.redZone);
  const late = situation.clock.quarter === 4 && situation.clock.secondsLeft <= 300;
  if (late && situation.offenseLead < 0) multiply(weights, adjustments.protectingLead);
  if (late && situation.offenseLead > 0) multiply(weights, adjustments.trailingLate);
  return weights;
};

export const chooseDefensiveIntent = (
  playId: number,
  situation: PlaySituation,
): DefensiveIntent => {
  const weights = defensiveIntentWeights(situation);
  const selected = createSeededRandom(playId).fork('defensive-intent').weightedChoice(
    DEFENSIVE_INTENTS.map(intent => ({ item: intent, weight: weights[intent] })),
  );
  if (!selected) throw new Error('Defensive intent weights are invalid.');
  return selected;
};

export const defensiveProfile = (
  intent: DefensiveIntent,
  concept: OffensiveConcept,
) => SIM_TUNING.defense.matchups[intent][concept];
