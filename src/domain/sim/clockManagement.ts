import type {
  ClockManagementAction,
  ClockTempo,
} from '../../types/db';
import type {
  InteractiveStepInstruction,
  ClockState,
  SimGame,
  TimeoutInstruction,
} from '../../types/sim';
import type { Team } from '../../types/domain';
import type { OffenseTimeoutRequest, TimeoutRequest } from './clock';
import { SIM_TUNING } from './config';

export const CLOCK_MANAGEMENT_LABELS: Record<ClockManagementAction, string> = {
  spike: 'Spike',
  kneel: 'Kneel',
};

export const CLOCK_TEMPO_LABELS: Record<ClockTempo, string> = {
  normal: 'Normal',
  hurry_up: 'Hurry',
  chew_clock: 'Chew',
};

export const AUTO_STEP_INSTRUCTION: InteractiveStepInstruction = {
  call: 'auto',
  tempo: 'auto',
  timeoutAfter: { offense: 'auto', defense: 'auto' },
};

const CLOCK_TEMPOS: ClockTempo[] = ['normal', 'hurry_up', 'chew_clock'];
const TIMEOUT_INSTRUCTIONS: TimeoutInstruction[] = ['auto', 'use', 'hold'];

const exactKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length
    && actual.every((key, index) => key === [...keys].sort()[index]);
};

export const isClockManagementAction = (value: unknown): value is ClockManagementAction =>
  value === 'spike' || value === 'kneel';

export const isInteractiveStepInstruction = (
  value: unknown,
): value is InteractiveStepInstruction => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const instruction = value as Record<string, unknown>;
  if (!exactKeys(instruction, ['call', 'tempo', 'timeoutAfter'])) return false;
  if (!(instruction.tempo === 'auto' || CLOCK_TEMPOS.includes(instruction.tempo as ClockTempo))) {
    return false;
  }
  const timeoutAfter = instruction.timeoutAfter;
  if (!timeoutAfter || typeof timeoutAfter !== 'object' || Array.isArray(timeoutAfter)) return false;
  const timeoutRecord = timeoutAfter as Record<string, unknown>;
  if (!exactKeys(timeoutRecord, ['offense', 'defense'])) return false;
  if (!TIMEOUT_INSTRUCTIONS.includes(timeoutRecord.offense as TimeoutInstruction)
    || !TIMEOUT_INSTRUCTIONS.includes(timeoutRecord.defense as TimeoutInstruction)) return false;
  if (timeoutRecord.offense === 'use' && timeoutRecord.defense === 'use') return false;

  const call = instruction.call;
  if (call === 'auto') return true;
  if (!call || typeof call !== 'object' || Array.isArray(call)) return false;
  const callRecord = call as Record<string, unknown>;
  if (callRecord.kind === 'offense') {
    return exactKeys(callRecord, ['kind', 'concept']) && typeof callRecord.concept === 'string';
  }
  if (callRecord.kind === 'defense') {
    return exactKeys(callRecord, ['kind', 'intent']) && typeof callRecord.intent === 'string';
  }
  if (callRecord.kind === 'special_teams') {
    return exactKeys(callRecord, ['kind', 'concept'])
      && (callRecord.concept === 'punt' || callRecord.concept === 'field_goal');
  }
  if (callRecord.kind === 'try') {
    return exactKeys(callRecord, ['kind', 'attempt'])
      && callRecord.attempt === 'extra_point';
  }
  if (callRecord.kind === 'try_offense') {
    return exactKeys(callRecord, ['kind', 'concept']) && typeof callRecord.concept === 'string';
  }
  if (callRecord.kind === 'try_defense') {
    return exactKeys(callRecord, ['kind', 'intent']) && typeof callRecord.intent === 'string';
  }
  return callRecord.kind === 'clock_management'
    && exactKeys(callRecord, ['kind', 'action'])
    && isClockManagementAction(callRecord.action);
};

export type ManagementSituation = {
  game: SimGame;
  offense: Team;
  defense: Team;
  offenseLead: number;
  down: number;
  clock: ClockState;
};

export const timeoutsRemainingFor = (game: SimGame, teamId: number) => {
  if (teamId === game.teamA.id) return game.timeoutsRemainingA;
  if (teamId === game.teamB.id) return game.timeoutsRemainingB;
  throw new Error(`Team ${teamId} is not participating in game ${game.id}.`);
};

export const chargeTimeout = (game: SimGame, teamId: number) => {
  if (teamId === game.teamA.id) {
    if (game.timeoutsRemainingA <= 0) throw new Error(`${game.teamA.name} has no timeouts remaining.`);
    game.timeoutsRemainingA -= 1;
    return;
  }
  if (teamId === game.teamB.id) {
    if (game.timeoutsRemainingB <= 0) throw new Error(`${game.teamB.name} has no timeouts remaining.`);
    game.timeoutsRemainingB -= 1;
    return;
  }
  throw new Error(`Team ${teamId} is not participating in game ${game.id}.`);
};

export const resetSecondHalfTimeouts = (game: SimGame) => {
  game.timeoutsRemainingA = 3;
  game.timeoutsRemainingB = 3;
};

export const chooseAutomaticTempo = (
  offenseLead: number,
  clock: ClockState,
): ClockTempo => {
  const firstDownStop = SIM_TUNING.clock.firstDownStopSeconds;
  const lateSecondHalf = SIM_TUNING.clock.outOfBoundsStop.secondHalfSeconds;
  if (clock.quarter === 2 && clock.secondsLeft <= firstDownStop && offenseLead < 0) {
    return 'hurry_up';
  }
  if (clock.quarter === 4 && clock.secondsLeft <= lateSecondHalf && offenseLead < 0) {
    return 'hurry_up';
  }
  if (clock.quarter === 4 && clock.secondsLeft <= lateSecondHalf && offenseLead > 7) {
    return 'chew_clock';
  }
  return 'normal';
};

export const chooseAutomaticClockAction = (
  situation: ManagementSituation,
): ClockManagementAction | null => {
  const { game, offense, defense, offenseLead, down, clock } = situation;
  if (clock.quarter === 4 && offenseLead > 0) {
    const defenseTimeouts = timeoutsRemainingFor(game, defense.id);
    const unstoppedKneels = Math.max(0, 4 - down - defenseTimeouts);
    if (clock.secondsLeft <= unstoppedKneels * SIM_TUNING.clock.management.kneelBudgetSeconds) {
      return 'kneel';
    }
  }
  const offenseTimeouts = timeoutsRemainingFor(game, offense.id);
  const spikeWindow = SIM_TUNING.clock.management.spikeWindowSeconds;
  if (
    (clock.quarter === 2 || clock.quarter === 4)
    && clock.clockRunning
    && clock.secondsLeft >= SIM_TUNING.clock.management.minimumSpikeSeconds
    && clock.secondsLeft <= spikeWindow
    && offenseLead <= 0
    && offenseTimeouts === 0
    && down <= 3
  ) return 'spike';
  return null;
};

const automaticTimeoutForSide = (
  side: 'offense' | 'defense',
  situation: ManagementSituation,
) => {
  const { game, offense, defense, offenseLead, clock } = situation;
  const team = side === 'offense' ? offense : defense;
  if (timeoutsRemainingFor(game, team.id) <= 0) return false;
  const teamLead = side === 'offense' ? offenseLead : -offenseLead;
  if (teamLead >= 0) return false;
  if (side === 'offense') {
    return (clock.quarter === 2 || clock.quarter === 4)
      && clock.secondsLeft <= SIM_TUNING.clock.management.trailingOffenseTimeoutSeconds;
  }
  if (clock.quarter === 2) {
    return clock.secondsLeft <= SIM_TUNING.clock.management.trailingDefenseFirstHalfSeconds;
  }
  if (clock.quarter === 4) {
    const remaining = timeoutsRemainingFor(game, defense.id);
    return clock.secondsLeft <= SIM_TUNING.clock.management.kneelBudgetSeconds * (remaining + 1);
  }
  return false;
};

export const chooseAutomaticOffenseTimeoutRequest = (
  situation: ManagementSituation,
): OffenseTimeoutRequest | null => automaticTimeoutForSide('offense', situation)
  ? { side: 'offense', timing: 'immediate' }
  : null;

export const resolveTimeoutRequest = (
  instruction: InteractiveStepInstruction['timeoutAfter'],
  situation: ManagementSituation,
  automaticOffenseTimeoutRequest: OffenseTimeoutRequest | null,
): TimeoutRequest | null => {
  const explicitSide = instruction.offense === 'use'
    ? 'offense'
    : instruction.defense === 'use'
      ? 'defense'
      : null;
  if (explicitSide) {
    const team = explicitSide === 'offense' ? situation.offense : situation.defense;
    if (timeoutsRemainingFor(situation.game, team.id) <= 0) {
      throw new Error(`${team.name} has no timeouts remaining.`);
    }
    return { side: explicitSide, timing: 'immediate' };
  }
  if (instruction.offense === 'auto' && automaticOffenseTimeoutRequest !== null) {
    return automaticOffenseTimeoutRequest;
  }
  if (instruction.defense === 'auto' && automaticTimeoutForSide('defense', situation)) {
    return { side: 'defense', timing: 'immediate' };
  }
  return null;
};

export const resolveTempo = (
  requested: ClockTempo | 'auto',
  automaticTempo: ClockTempo,
  action: ClockManagementAction | null,
): ClockTempo => {
  if (action === 'spike') return 'hurry_up';
  if (action === 'kneel') return 'chew_clock';
  return requested === 'auto' ? automaticTempo : requested;
};

export const canShowSpike = (down: number, clock: ClockState) => (
  (clock.quarter === 2 || clock.quarter === 4)
  && clock.secondsLeft <= SIM_TUNING.clock.firstDownStopSeconds
  && clock.secondsLeft >= SIM_TUNING.clock.management.minimumSpikeSeconds
  && clock.clockRunning
  && down <= 3
);

export const canShowKneel = (offenseLead: number, clock: ClockState) => (
  (clock.quarter === 2 || clock.quarter === 4)
  && clock.secondsLeft <= SIM_TUNING.clock.firstDownStopSeconds
  && offenseLead >= 0
);
