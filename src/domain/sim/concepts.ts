import type { OffensiveConcept, PlayCall } from '../../types/db';
import type { PlaySituation } from '../../types/sim';
import { SIM_TUNING } from './config';
import { isDefensiveIntent } from './defensiveIntents';
import { isClockManagementAction } from './clockManagement';

export const RUN_CONCEPTS = ['inside_run', 'outside_run', 'option'] as const;
export const PASS_CONCEPTS = [
  'quick_pass',
  'intermediate_pass',
  'deep_pass',
  'screen',
  'play_action',
] as const;
export const OFFENSIVE_CONCEPTS = [...RUN_CONCEPTS, ...PASS_CONCEPTS] as const;
export type RunConcept = typeof RUN_CONCEPTS[number];
export type PassConcept = typeof PASS_CONCEPTS[number];

export const CONCEPT_LABELS: Record<OffensiveConcept, string> = {
  inside_run: 'Inside',
  outside_run: 'Outside',
  option: 'Option',
  quick_pass: 'Quick',
  intermediate_pass: 'Intermediate',
  deep_pass: 'Deep',
  screen: 'Screen',
  play_action: 'Play Action',
};

const RUN_SET = new Set<OffensiveConcept>(RUN_CONCEPTS);
const PASS_SET = new Set<OffensiveConcept>(PASS_CONCEPTS);

export const isOffensiveConcept = (value: unknown): value is OffensiveConcept =>
  typeof value === 'string' && OFFENSIVE_CONCEPTS.includes(value as OffensiveConcept);

export const playTypeForCall = (call: PlayCall) => {
  if (call.kind === 'try') {
    if (call.attempt === 'extra_point') return 'extra point';
    return RUN_SET.has(call.offense) ? 'run' : 'pass';
  }
  if (call.kind === 'clock_management') return call.action === 'spike' ? 'pass' : 'run';
  if (call.kind === 'special_teams') {
    return call.concept === 'field_goal' ? 'field goal' : 'punt';
  }
  return RUN_SET.has(call.offense) ? 'run' : 'pass';
};

export const isPlayCall = (value: unknown): value is PlayCall => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.kind === 'scrimmage') {
    return Object.keys(record).length === 3
      && isOffensiveConcept(record.offense)
      && isDefensiveIntent(record.defense);
  }
  if (record.kind === 'clock_management') {
    return Object.keys(record).length === 2 && isClockManagementAction(record.action);
  }
  if (record.kind === 'try') {
    if (record.attempt === 'extra_point') {
      return Object.keys(record).length === 2;
    }
    return record.attempt === 'two_point'
      && Object.keys(record).length === 4
      && isOffensiveConcept(record.offense)
      && isDefensiveIntent(record.defense);
  }
  return record.kind === 'special_teams'
    && Object.keys(record).length === 2
    && (record.concept === 'punt' || record.concept === 'field_goal');
};

export const validatePlayCall = (
  call: PlayCall,
  down: number,
  playType?: string,
) => {
  const errors: string[] = [];
  if (!isPlayCall(call)) return ['invalid play call'];
  if (call.kind === 'special_teams' && call.concept === 'punt' && down !== 4) {
    errors.push('punt before fourth down');
  }
  if (call.kind === 'clock_management' && call.action === 'spike' && down > 3) {
    errors.push('spike on fourth down');
  }
  if (playType !== undefined && playTypeForCall(call) !== playType) {
    errors.push('call and play type disagree');
  }
  return errors;
};

const multiply = (
  weights: Record<string, number>,
  adjustment: Record<string, number>,
) => {
  for (const [concept, multiplier] of Object.entries(adjustment)) {
    if (weights[concept] !== undefined) weights[concept] *= multiplier;
  }
};

export const conceptWeights = (
  playType: 'run' | 'pass',
  situation: PlaySituation,
): Record<string, number> => {
  const base = playType === 'run'
    ? SIM_TUNING.concepts.automatic.run
    : SIM_TUNING.concepts.automatic.pass;
  const weights: Record<string, number> = { ...base };
  const adjustments = SIM_TUNING.concepts.automatic.adjustments;
  if (situation.yardsLeft <= 3) multiply(weights, adjustments.shortYardage);
  if (situation.yardsLeft >= 7) multiply(weights, adjustments.longYardage);
  if (situation.fieldPosition >= 80) multiply(weights, adjustments.redZone);
  const late = situation.clock.quarter === 4 && situation.clock.secondsLeft <= 300;
  if (late && situation.offenseLead < 0) multiply(weights, adjustments.lateTrailing);
  if (late && situation.offenseLead > 0) multiply(weights, adjustments.lateLeading);
  return weights;
};

const weightedConcept = (weights: Record<string, number>) => {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Concept weights are invalid.');
  let pick = Math.random() * total;
  for (const [concept, weight] of entries) {
    pick -= weight;
    if (pick <= 0) return concept as OffensiveConcept;
  }
  return entries[entries.length - 1][0] as OffensiveConcept;
};

export const chooseOffensiveCall = (
  playType: 'run' | 'pass',
  situation: PlaySituation,
): OffensiveConcept => weightedConcept(conceptWeights(playType, situation));

export const isRunConcept = (concept: OffensiveConcept): concept is RunConcept =>
  RUN_SET.has(concept);
export const isPassConcept = (concept: OffensiveConcept): concept is PassConcept =>
  PASS_SET.has(concept);
