import type { PlayerRecord } from './db';

export type PlayerProgressionProjection =
  | {
      status: 'returning';
      projectedClass: PlayerRecord['year'];
      projectedRating: number;
    }
  | {
      status: 'departing';
    };

export interface ReturningPlayerPreview {
  id: number;
  first: string;
  last: string;
  position: string;
  currentClass: PlayerRecord['year'];
  projectedClass: PlayerRecord['year'];
  currentRating: number;
  projectedRating: number;
  ratingChange: number;
}

export interface DepartingPlayerPreview {
  id: number;
  first: string;
  last: string;
  position: string;
  currentClass: 'sr';
  currentRating: number;
}

export interface RosterProgressionSummary {
  returningPlayers: number;
  departingSeniors: number;
  averageRatingChange: number;
  maximumRatingChange: number;
}

export interface RosterCutPlayerPreview {
  id: number;
  first: string;
  last: string;
  position: string;
  currentClass: PlayerRecord['year'];
  currentRating: number;
  selected: boolean;
  recommended: boolean;
  protected: boolean;
  canSelect: boolean;
  blockedReason:
    | 'FRESHMAN_PROTECTED'
    | 'CUTS_COMPLETE'
    | 'STARTER_MINIMUM'
    | null;
}

export interface RosterPositionCutPreview {
  position: string;
  activePlayers: number;
  rosterLimit: number;
  starterMinimum: number;
  selectedCuts: number;
  projectedCuts: number;
  projectedPlayers: number;
}

export interface RosterCutsSummary {
  activePlayers: number;
  requiredCuts: number;
  selectedCuts: number;
  remainingCuts: number;
  projectedCuts: number;
  projectedRosterSize: number;
  positionsOverLimit: number;
}

export interface RosterCutsPreview {
  players: RosterCutPlayerPreview[];
  selectedCutIds: number[];
  recommendedCutIds: number[];
  positions: RosterPositionCutPreview[];
  summary: RosterCutsSummary;
}

export interface RosterFinalizationCommandGuard {
  expectedStage: 'roster_cuts';
  expectedYear: number;
  expectedRound: 6;
  expectedStatus: 'finalized';
  expectedVersion: number;
}

export interface RosterFinalizationCursor {
  stage: 'roster_cuts';
  year: number;
  round: 6;
  status: 'finalized';
  version: number;
  pendingUserCutIds: number[];
  requiredCuts: number;
  route: string;
}

export interface FinalizeRosterResult {
  previousStage: 'roster_cuts';
  currentStage: 'preseason';
  route: string;
}

export type RosterFinalizationConflictCode =
  | 'STATE_MISSING'
  | 'STAGE_MISMATCH'
  | 'YEAR_MISMATCH'
  | 'ROUND_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'VERSION_MISMATCH';

export class RosterFinalizationConflictError extends Error {
  constructor(
    readonly code: RosterFinalizationConflictCode,
    readonly expected: unknown,
    readonly actual: unknown,
  ) {
    super(
      `Roster finalization conflict (${code}): expected ${String(expected)}, received ${String(actual)}.`,
    );
    this.name = 'RosterFinalizationConflictError';
  }
}

export type RosterFinalizationRuleCode =
  | 'UNKNOWN_PLAYER'
  | 'WRONG_TEAM'
  | 'PLAYER_INACTIVE'
  | 'FRESHMAN_PROTECTED'
  | 'DUPLICATE_CUT'
  | 'CUT_NOT_SELECTED'
  | 'CUT_COUNT_EXCEEDED'
  | 'CUT_COUNT_INCOMPLETE'
  | 'STARTER_MINIMUM'
  | 'INVALID_POSITION'
  | 'INVALID_ROSTER_SIZE'
  | 'NO_LEGAL_CUT'
  | 'INVALID_PLAYER_COUNTER'
  | 'INVALID_WALK_ON_DATA';

export class RosterFinalizationRuleError extends Error {
  constructor(
    readonly code: RosterFinalizationRuleCode,
    message: string,
    readonly playerId?: number,
    readonly teamId?: number,
  ) {
    super(message);
    this.name = 'RosterFinalizationRuleError';
  }
}
