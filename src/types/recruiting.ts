export interface RecruitingPlayerResult {
  rank: number;
  prospectId: number;
  first: string;
  last: string;
  position: string;
  stars: number;
  teamId: number;
  teamName: string;
}

export interface RecruitingStarCounts {
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
}

export interface RecruitingTeamResult {
  rank: number;
  teamId: number;
  teamName: string;
  conference: string;
  prestige: number;
  recruits: RecruitingPlayerResult[];
  totalRecruits: number;
  averageStars: number;
  starCounts: RecruitingStarCounts;
  classScore: number;
}

export interface RecruitingResultsSummary {
  totalRecruits: number;
}

export interface RecruitingResults {
  teamRankings: RecruitingTeamResult[];
  playerRankings: RecruitingPlayerResult[];
  positions: string[];
  userTeam: RecruitingTeamResult | null;
  summary: RecruitingResultsSummary;
}

export interface RecruitingPreferenceWeights {
  prestige: number;
  proximity: number;
  playingTime: number;
  recentSuccess: number;
}

export interface RecruitingInterestEntry {
  teamId: number;
  fit: number;
  initial: number;
  earned: number;
  lifetimePoints: number;
}

export interface RecruitingProspect {
  id: number;
  nationalRank: number;
  first: string;
  last: string;
  state: string;
  position: string;
  stars: number;
  ratingFr: number;
  ratingSo: number;
  ratingJr: number;
  ratingSr: number;
  developmentTrait: number;
  publicRatingMin: number;
  publicRatingMax: number;
  preferenceWeights: RecruitingPreferenceWeights;
  interest: RecruitingInterestEntry[];
  committedTeamId: number | null;
  committedRound: RecruitingRound | 'signing_day' | null;
}

export interface TeamRecruitingState {
  teamId: number;
  board: number[];
  allocations: Record<number, number>;
  commitmentIds: number[];
  baseSigningCapacity: number;
  oversignCapacity: number;
  pointBudget: number;
}

export type RecruitingRound = 1 | 2 | 3 | 4 | 5 | 6;
export type RecruitingSimulationStatus =
  | 'active'
  | 'ready_for_signing_day'
  | 'finalized';

export interface RecruitingSimulationState {
  year: number;
  round: RecruitingRound;
  status: RecruitingSimulationStatus;
  seed: number;
  prospects: RecruitingProspect[];
  teams: TeamRecruitingState[];
}

export interface RecruitingState extends RecruitingSimulationState {
  version: number;
  pendingUserCutIds: number[];
}

export class RecruitingDataIntegrityError extends Error {
  readonly code = 'INVALID_RECRUITING_STATE';

  constructor() {
    super(
      'The saved recruiting state does not match the current data model. Start a new league.',
    );
    this.name = 'RecruitingDataIntegrityError';
  }
}

export type RecruitingConflictCode =
  | 'STATE_MISSING'
  | 'STATE_EXISTS'
  | 'STAGE_MISMATCH'
  | 'YEAR_MISMATCH'
  | 'ROUND_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'VERSION_MISMATCH';

export class RecruitingConflictError extends Error {
  constructor(
    readonly code: RecruitingConflictCode,
    readonly expected: unknown,
    readonly actual: unknown,
  ) {
    super(`Recruiting conflict (${code}): expected ${String(expected)}, received ${String(actual)}.`);
    this.name = 'RecruitingConflictError';
  }
}

export interface RecruitingCommitmentEvent {
  prospectId: number;
  teamId: number;
  round: RecruitingRound | 'signing_day';
}

export interface RecruitingCommandCursor {
  stage: 'recruiting' | 'recruiting_summary';
  year: number;
  round: RecruitingRound;
  status: RecruitingSimulationStatus;
  version: number;
  route: string;
  commitments: RecruitingCommitmentEvent[];
}

export interface InitializeRecruitingInput {
  expectedStage: 'progression';
  expectedYear: number;
  seed?: number;
}

export interface RecruitingCommandGuard {
  expectedStage: 'recruiting';
  expectedYear: number;
  expectedRound: RecruitingRound;
  expectedVersion: number;
}

export interface UpdateRecruitingBoardInput extends RecruitingCommandGuard {
  prospectIds: number[];
}

export interface AdvanceRecruitingRoundInput extends RecruitingCommandGuard {
  allocations: Record<number, number>;
}

export interface CompleteRecruitingWithAiInput
  extends RecruitingCommandGuard {
  allocations: Record<number, number>;
}

export interface RecruitingAssistanceSummary {
  pointsAdded: number;
  prospectIdsAdded: number[];
}

export interface RecruitingRoundCommandResult
  extends RecruitingCommandCursor {
  assistance: RecruitingAssistanceSummary;
}

export type RecruitingRuleViolationCode =
  | 'BOARD_LIMIT'
  | 'DUPLICATE_PROSPECT'
  | 'UNKNOWN_PROSPECT'
  | 'PROSPECT_COMMITTED'
  | 'NOT_ON_BOARD'
  | 'INVALID_ALLOCATION'
  | 'ROUND_BUDGET_EXCEEDED'
  | 'PROSPECT_CAP_EXCEEDED'
  | 'SIGNING_CAPACITY_FULL'
  | 'UNKNOWN_TEAM'
  | 'MISSING_INTEREST'
  | 'INVALID_ROUND'
  | 'INVALID_STATUS';

export interface RecruitingRuleViolation {
  code: RecruitingRuleViolationCode;
  teamId: number;
  prospectId?: number;
}

export interface RecruitingResolution {
  state: RecruitingSimulationState;
  commitments: RecruitingCommitmentEvent[];
}

export interface AiPublicInterest {
  teamId: number;
  totalInterest: number;
  lifetimePoints: number;
  onBoard: boolean;
}

export interface AiPublicProspect {
  id: number;
  nationalRank: number;
  position: string;
  stars: number;
  preferenceWeights: RecruitingPreferenceWeights;
  committedTeamId: number | null;
  interest: AiPublicInterest[];
}

export interface AiPositionNeed {
  returning: number;
  committed: number;
  projected: number;
  starters: number;
  softTarget: number;
  starterShortage: number;
  softDeficit: number;
}

export interface AiTeamProspectFit {
  prospectId: number;
  fit: number;
  canAccept: boolean;
}

export interface AiRecruitingTeamSnapshot {
  teamId: number;
  pointBudget: number;
  perProspectCap: number;
  board: number[];
  commitmentIds: number[];
  remainingBaseSlots: number;
  remainingTargetSlots: number;
  remainingMaximumSlots: number;
  positions: Record<string, AiPositionNeed>;
  prospectFits: AiTeamProspectFit[];
}

export interface AiRecruitingSnapshot {
  year: number;
  round: RecruitingRound;
  remainingRounds: number;
  seed: number;
  prospects: AiPublicProspect[];
  teams: AiRecruitingTeamSnapshot[];
}

export interface AiRecruitingDecisionDiagnostics {
  targetsAdded: number;
  targetsRemoved: number;
  meaningfulTargets: number;
  budgetAllocated: number;
  pursuitsAdmitted: number;
  fundableOpeningsUnfilled: number;
}

export interface AiRecruitingDecision {
  teamId: number;
  board: number[];
  allocations: Record<number, number>;
  diagnostics: AiRecruitingDecisionDiagnostics;
}
