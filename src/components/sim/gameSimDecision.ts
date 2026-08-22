import { AUTO_STEP_INSTRUCTION } from '../../domain/sim/clockManagement';
import {
  chooseAutomaticTryAttempt,
  extraPointAllowed,
} from '../../domain/sim/conversions';
import {
  buildAutomaticOffenseSituation,
  chooseAutomaticOffensePlan,
} from '../../domain/sim/playcalling';
import type { ClockTempo } from '../../types/db';
import type { Team } from '../../types/domain';
import type {
  InteractiveDriveState,
  InteractiveStepInstruction,
  SimGame,
} from '../../types/sim';
import type {
  SimulationDecision,
  SimulationDecisionPrompt,
} from './gameSimTypes';

type DecisionPromptInput = {
  driveState: InteractiveDriveState | null;
  userTeamId: number | null;
  currentOffense: Team | null;
  currentDefense: Team | null;
  simGame: SimGame;
  inOvertime: boolean;
  overtimePossession: number;
};

type StepInstructionInput = {
  call: SimulationDecision;
  drivePhase: InteractiveDriveState['phase'] | null;
  userTeamId: number | null;
  offenseId: number | null;
  defenseId: number | null;
  selectedTempo: ClockTempo | 'auto';
  timeoutAfterPlay: boolean;
  useArmedTimeout: boolean;
};

const buildDecisionPrompt = (
  state: InteractiveDriveState,
  side: SimulationDecisionPrompt['side'],
): Extract<SimulationDecisionPrompt, { type: 'scrimmage' }> => ({
  side,
  type: 'scrimmage',
  down: state.down,
  yardsLeft: state.yardsLeft,
  fieldPosition: state.fieldPosition,
});

export const resolveGameSimDecisionPrompt = ({
  driveState,
  userTeamId,
  currentOffense,
  currentDefense,
  simGame,
  inOvertime,
  overtimePossession,
}: DecisionPromptInput): SimulationDecisionPrompt | null => {
  if (!driveState || !userTeamId) return null;

  if (driveState.phase === 'try' && driveState.tryOrigin) {
    const automaticAttempt = currentOffense
      ? chooseAutomaticTryAttempt({
          game: simGame,
          offense: currentOffense,
          origin: driveState.tryOrigin,
          overtimePossession: inOvertime ? overtimePossession as 0 | 1 : null,
        })
      : 'extra_point';

    if (currentOffense?.id === userTeamId) {
      return {
        ...buildDecisionPrompt(driveState, 'offense'),
        type: 'try',
        allowExtraPoint: extraPointAllowed(simGame, driveState.tryOrigin),
      };
    }
    if (currentDefense?.id === userTeamId && automaticAttempt === 'two_point') {
      return {
        ...buildDecisionPrompt(driveState, 'defense'),
        type: 'try',
        allowExtraPoint: false,
      };
    }
    return null;
  }

  if (currentOffense?.id === userTeamId) {
    return buildDecisionPrompt(driveState, 'offense');
  }

  if (currentDefense?.id === userTeamId) {
    if (currentOffense) {
      const automaticPlan = chooseAutomaticOffensePlan(
        buildAutomaticOffenseSituation({
          game: simGame,
          offense: currentOffense,
          defense: currentDefense,
          down: driveState.down,
          yardsLeft: driveState.yardsLeft,
          fieldPosition: driveState.fieldPosition,
          clockEnabled: !inOvertime,
          automaticOffenseIntent: driveState.automaticOffenseIntent,
        }),
        'auto',
      );
      if (automaticPlan.action.kind !== 'scrimmage') return null;
    }
    return buildDecisionPrompt(driveState, 'defense');
  }

  return null;
};

export const buildGameSimStepInstruction = ({
  call,
  drivePhase,
  userTeamId,
  offenseId,
  defenseId,
  selectedTempo,
  timeoutAfterPlay,
  useArmedTimeout,
}: StepInstructionInput): InteractiveStepInstruction => {
  if (offenseId === null || defenseId === null) {
    return {
      ...AUTO_STEP_INSTRUCTION,
      timeoutAfter: { ...AUTO_STEP_INSTRUCTION.timeoutAfter },
    };
  }
  if (drivePhase === 'try') {
    return {
      call,
      tempo: 'auto',
      timeoutAfter: { offense: 'hold', defense: 'hold' },
    };
  }

  const userOnOffense = offenseId === userTeamId;
  const userOnDefense = defenseId === userTeamId;
  const useTimeout = useArmedTimeout && timeoutAfterPlay;
  return {
    call,
    tempo: userOnOffense ? selectedTempo : 'auto',
    timeoutAfter: {
      offense: userOnOffense ? useTimeout ? 'use' : 'hold' : 'auto',
      defense: userOnDefense ? useTimeout ? 'use' : 'hold' : 'auto',
    },
  };
};
