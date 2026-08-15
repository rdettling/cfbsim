import type { InteractivePlayChoice } from '../../types/sim';

export type SimulationPhase =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'advancing'
  | 'finalizing'
  | 'complete'
  | 'error';

export type SimulationErrorKind = 'preparation' | 'simulation' | 'finalization';
export type SimulationAdvanceScope = 'play' | 'drive' | 'game';
export type SimulationDecision = InteractivePlayChoice;
export type GameSimUserSide = 'offense' | 'defense' | null;

export type GameSimSituation = {
  down: number;
  yardsLeft: number;
  fieldPosition: number;
};

type SimulationDecisionPromptBase = GameSimSituation & {
  side: Exclude<GameSimUserSide, null>;
};

export type SimulationDecisionPrompt =
  | SimulationDecisionPromptBase & { type: 'scrimmage' }
  | SimulationDecisionPromptBase & { type: 'try'; allowExtraPoint: boolean };

export type SimulationError = {
  kind: SimulationErrorKind;
  message: string;
};
