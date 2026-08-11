import type {
  ClockQuarter,
  DefensiveIntent,
  OffensiveConcept,
  PlayCall,
  PlayTiming,
} from '../../types/db';
import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import { SIM_TUNING } from './config';
import { isPassConcept, isRunConcept } from './concepts';

export const TRY_FIELD_POSITION = 97;
export const TRY_YARDS = 3;

export type TryOrigin = 'touchdown' | 'overtime_shootout';

export const TWO_POINT_RESULTS = [
  'made two point run',
  'made two point pass',
  'failed two point run',
  'failed two point pass',
  'failed two point incomplete',
  'failed two point sack',
  'failed two point interception',
  'failed two point fumble',
] as const;

export type TwoPointResult = typeof TWO_POINT_RESULTS[number];

export const isTwoPointResult = (result: string): result is TwoPointResult =>
  TWO_POINT_RESULTS.includes(result as TwoPointResult);

export const twoPointSucceeded = (result: string) =>
  result === 'made two point run' || result === 'made two point pass';

export const mapTwoPointResult = (
  call: Extract<PlayCall, { kind: 'try'; attempt: 'two_point' }>,
  outcome: string,
): TwoPointResult => {
  if (outcome === 'touchdown') {
    return isRunConcept(call.offense) ? 'made two point run' : 'made two point pass';
  }
  if (isRunConcept(call.offense)) {
    return outcome === 'fumble' ? 'failed two point fumble' : 'failed two point run';
  }
  if (outcome === 'sack') return 'failed two point sack';
  if (outcome === 'interception') return 'failed two point interception';
  if (outcome === 'incomplete pass') return 'failed two point incomplete';
  return 'failed two point pass';
};

export const makeExtraPoint = () =>
  Math.random() < SIM_TUNING.conversions.extraPointMakeProbability;

const offenseLead = (game: SimGame, offense: Team) =>
  offense.id === game.teamA.id
    ? game.scoreA - game.scoreB
    : game.scoreB - game.scoreA;

export const chooseAutomaticTryAttempt = ({
  game,
  offense,
  origin,
  overtimePossession,
}: {
  game: SimGame;
  offense: Team;
  origin: TryOrigin;
  overtimePossession: 0 | 1 | null;
}): 'extra_point' | 'two_point' => {
  if (origin === 'overtime_shootout' || game.overtime >= 2) return 'two_point';
  const lead = offenseLead(game, offense);
  if (game.overtime === 1) {
    return overtimePossession === 1 && lead === -2 ? 'two_point' : 'extra_point';
  }
  return game.quarter === 4
    && game.clockSecondsLeft <= SIM_TUNING.conversions.automaticTwoPoint.lateRegulationSeconds
    && SIM_TUNING.conversions.automaticTwoPoint.postTouchdownMargins.includes(lead)
    ? 'two_point'
    : 'extra_point';
};

export const extraPointAllowed = (game: SimGame, origin: TryOrigin) =>
  origin === 'touchdown' && game.overtime < 2;

export const tryRequiredAfterTouchdown = ({
  game,
  offense,
  overtimePossession,
}: {
  game: SimGame;
  offense: Team;
  overtimePossession: 0 | 1 | null;
}) => {
  const lead = offenseLead(game, offense);
  if (game.overtime > 0) {
    return overtimePossession !== 1 || (lead <= 0 && lead >= -2);
  }
  if (game.quarter === 4 && game.clockSecondsLeft === 0) {
    return lead <= 0 && lead >= -2;
  }
  return true;
};

export const buildTryTiming = (
  game: SimGame,
): Extract<PlayTiming, { kind: 'try' }> => game.overtime > 0
  ? { kind: 'try', context: 'overtime', period: game.overtime }
  : {
      kind: 'try',
      context: 'regulation',
      quarter: game.quarter as ClockQuarter,
      secondsLeft: game.clockSecondsLeft,
    };

export const buildTryTimingFromTouchdown = (
  timing: Exclude<PlayTiming, { kind: 'try' }>,
): Extract<PlayTiming, { kind: 'try' }> => timing.kind === 'overtime'
  ? { kind: 'try', context: 'overtime', period: timing.period }
  : {
      kind: 'try',
      context: 'regulation',
      quarter: timing.end.quarter,
      secondsLeft: timing.end.secondsLeft,
    };

export const validateTryCall = (
  call: PlayCall,
  origin: TryOrigin,
  game: SimGame,
) => {
  if (call.kind !== 'try') return ['try phase requires a try call'];
  if (origin === 'overtime_shootout' && call.attempt !== 'two_point') {
    return ['overtime shootout requires a two-point attempt'];
  }
  if (call.attempt === 'extra_point' && !extraPointAllowed(game, origin)) {
    return ['extra point is not allowed in this overtime period'];
  }
  if (call.attempt === 'two_point'
    && !isRunConcept(call.offense)
    && !isPassConcept(call.offense)) {
    return ['two-point attempt has an invalid concept'];
  }
  return [];
};

export const tryResultMatchesCall = (call: PlayCall, result: string) => {
  if (call.kind !== 'try') return false;
  if (call.attempt === 'extra_point') {
    return result === 'made extra point' || result === 'missed extra point';
  }
  if (!isTwoPointResult(result)) return false;
  return isRunConcept(call.offense)
    ? result.endsWith('run') || result === 'failed two point fumble'
    : !result.endsWith('run') && result !== 'failed two point fumble';
};

export const defensiveIntentForTry = (
  call: PlayCall,
): DefensiveIntent | null => call.kind === 'try' && call.attempt === 'two_point'
  ? call.defense
  : null;

export const offensiveConceptForTry = (
  call: PlayCall,
): OffensiveConcept | null => call.kind === 'try' && call.attempt === 'two_point'
  ? call.offense
  : null;
