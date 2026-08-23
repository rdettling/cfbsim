import type { RecruitingSimulationStatus } from '../../../src/types/recruiting';

export interface AiRecruitingCycleReport {
  seed: number;
  checksum: string;
  status: RecruitingSimulationStatus;
  commitmentsByRound: Record<string, number>;
  signingDayShare: number;
  averageBudgetUse: number;
  targetsAdded: number;
  targetsRemoved: number;
  targetsLost: number;
  meaningfulPursuits: number;
  meaningfullyPursuedProspects: number;
  contestedMeaningfulProspects: number;
  meaningfulCompetitionRate: number;
  pursuitsAdmitted: number;
  fundableOpeningsUnfilled: number;
  baseSignings: number;
  oversignings: number;
  baseCapacityCompletion: number;
  lowPrestigeEliteWins: number;
  flags: string[];
  classesByPrestige: Record<
    number,
    {
      teams: number;
      signings: number;
      averagePublicRating: number;
      stars: Record<number, number>;
    }
  >;
  teams: Array<{
    teamId: number;
    baseCapacity: number;
    signings: number;
    baseSignings: number;
    oversignings: number;
  }>;
}

export interface RecruitingEvaluationTeamYear {
  teamId: number;
  teamName: string;
  prestigeBefore: number;
  prestigeAfter: number;
  classRank: number;
  classScore: number;
  classScoreExact: number;
  signed: number;
  baseCapacity: number;
  baseSignings: number;
  oversignings: number;
  walkOns: number;
  cuts: number;
  averagePublicRating: number;
  stars: Record<number, number>;
  offenseRating: number;
  defenseRating: number;
  rosterRating: number;
  rosterMeanRating: number;
  ratingContributors: {
    count: number;
    meanRating: number;
    ratings90Plus: number;
    ratings95Plus: number;
    ratings98Plus: number;
    ratings99: number;
  };
}

export interface RecruitingClassScoreDistribution {
  teams: number;
  minimum: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  maximum: number;
  mean: number;
  standardDeviation: number;
  exactDistinctScores: number;
  displayedDistinctScores: number;
  exactTieRate: number;
  displayedTieRate: number;
}

export interface RecruitingCountDistribution {
  count: number;
  minimum: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  maximum: number;
  mean: number;
}

export interface RecruitingSupplySummary {
  available: number;
  signed: number;
  unsigned: number;
  signingRate: number;
}

export interface RecruitingRosterRatingComparison {
  pairs: number;
  inversions: number;
  ties: number;
  inversionRate: number;
  tieRate: number;
}

export interface RecruitingTop25PrestigeEntry {
  eligibleTeamSeasons: number;
  appearances: number;
  compositionShare: number;
  appearanceRate: number;
}

export type RecruitingTop25Composition = Record<
  number,
  RecruitingTop25PrestigeEntry
>;

export interface RecruitingEvaluationSeason {
  year: number;
  seed: number;
  checksum: string;
  commitmentsByRound: Record<string, number>;
  signingDayShare: number;
  averageBudgetUse: number;
  targetsLost: number;
  targetsAdded: number;
  targetsRemoved: number;
  meaningfulPursuits: number;
  meaningfullyPursuedProspects: number;
  contestedMeaningfulProspects: number;
  meaningfulCompetitionRate: number;
  pursuitsAdmitted: number;
  fundableOpeningsUnfilled: number;
  baseCapacityCompletion: number;
  teamsCompletingBaseCapacity: number;
  teamBaseCapacityCompletionRate: number;
  oversignings: number;
  teamsUsingAllFourOversigns: number;
  lowPrestigeEliteWins: number;
  lowPrestigeEliteShare: number;
  prestigeClassScoreCorrelation: number;
  classScoreDistribution: RecruitingClassScoreDistribution;
  classSizeDistribution: RecruitingCountDistribution;
  supplyByStar: Record<number, RecruitingSupplySummary>;
  supplyByPosition: Record<string, RecruitingSupplySummary>;
  top25ClassComposition: RecruitingTop25Composition;
  walkOnsByPosition: Record<string, number>;
  walkOnsByPrestige: Record<number, number>;
  cutsByPosition: Record<string, number>;
  cutsByClass: Record<string, number>;
  averageCutRating: number;
  averageCutSeniorRating: number;
  teamsOversigningWithoutCuts: number;
  ratingSpread: number;
  prestigePromotions: number;
  prestigeDemotions: number;
  prestigeUnchanged: number;
  structuralViolations: string[];
  warnings: string[];
  rosterRatingInversionsByPrestigeGap: Record<
    number,
    RecruitingRosterRatingComparison
  >;
  prestigeSummaries: Record<
    number,
    {
      teams: number;
      averageClassScore: number;
      averagePublicRating: number;
      averageRosterRating: number;
      rosterRatingP10: number;
      rosterRatingP50: number;
      rosterRatingP90: number;
      stars: Record<number, number>;
      walkOns: number;
      cuts: number;
    }
  >;
  teams: RecruitingEvaluationTeamYear[];
}

export interface RecruitingEvaluationRun {
  seed: number;
  checksum: string;
  startYear: number;
  endYear: number;
  seasons: RecruitingEvaluationSeason[];
  initialPrestigeEndingRatingCorrelation: number;
  ratingSpreadChange: number;
  prestigeMobility: number;
  structuralViolations: string[];
}

export interface RecruitingBalanceRange {
  minimum?: number;
  maximum?: number;
}

export type RecruitingBalanceMetric =
  | 'baseCapacityCompletion'
  | 'teamBaseCapacityCompletionRate'
  | 'oversigningsPerTeamSeason'
  | 'teamsUsingAllFourOversignsRate'
  | 'walkOnsPerTeamSeason'
  | 'teamSeasonsUsingWalkOnsRate'
  | 'prestigeClassScoreCorrelation'
  | 'prestigeMobilityRate';

export interface RecruitingBalanceViolation {
  code:
    | 'BASE_CAPACITY_COMPLETION_BELOW_MINIMUM'
    | 'TEAM_BASE_CAPACITY_COMPLETION_RATE_BELOW_MINIMUM'
    | 'OVERSIGNINGS_PER_TEAM_SEASON_OUT_OF_RANGE'
    | 'ALL_FOUR_OVERSIGNS_RATE_ABOVE_MAXIMUM'
    | 'WALK_ONS_PER_TEAM_SEASON_ABOVE_MAXIMUM'
    | 'WALK_ON_TEAM_SEASON_RATE_ABOVE_MAXIMUM'
    | 'PRESTIGE_CLASS_SCORE_CORRELATION_OUT_OF_RANGE'
    | 'PRESTIGE_MOBILITY_RATE_OUT_OF_RANGE';
  metric: RecruitingBalanceMetric;
  actual: number;
  minimum?: number;
  maximum?: number;
}

export interface RecruitingEvaluationAggregate {
  signingDayShare: number;
  baseCapacityCompletion: number;
  teamsCompletingBaseCapacity: number;
  teamBaseCapacityCompletionRate: number;
  oversigningsPerTeamSeason: number;
  teamsUsingAllFourOversigns: number;
  teamsUsingAllFourOversignsRate: number;
  walkOnsPerTeamSeason: number;
  teamSeasonsUsingWalkOns: number;
  teamSeasonsUsingWalkOnsRate: number;
  meaningfulPursuits: number;
  meaningfullyPursuedProspects: number;
  contestedMeaningfulProspects: number;
  meaningfulCompetitionRate: number;
  pursuitsAdmitted: number;
  fundableOpeningsUnfilled: number;
  lowPrestigeEliteWins: number;
  lowPrestigeEliteShare: number;
  prestigeClassScoreCorrelation: number;
  classScoreDistribution: RecruitingClassScoreDistribution;
  classSizeDistribution: RecruitingCountDistribution;
  supplyByStar: Record<number, RecruitingSupplySummary>;
  supplyByPosition: Record<string, RecruitingSupplySummary>;
  top25ClassComposition: RecruitingTop25Composition;
  ratingSpreadChange: number;
  steadyStateRatingSpreadChange: number;
  prestigeMobility: number;
  prestigeMobilityRate: number;
  rosterRatingInversionsByPrestigeGap: Record<
    number,
    RecruitingRosterRatingComparison
  >;
}

export interface RecruitingEvaluationReport {
  rootSeed: number;
  derivedSeeds: number[];
  seedCount: number;
  replaySeedCount: number;
  seasonsPerSeed: number;
  startYear: number;
  endYear: number;
  teamCount: number;
  configuration: {
    rounds: number;
    boardLimit: number;
    meaningfulPursuitPoints: number;
    commitmentThreshold: number;
    commitmentLead: number;
    rosterSize: number;
    oversignAllowance: number;
    aiTargetOversignings: number;
    recruitStarCounts: Record<number, number>;
  };
  balanceTargets: Record<RecruitingBalanceMetric, RecruitingBalanceRange>;
  rosterRatingOverlapTargets: Record<number, RecruitingBalanceRange>;
  rosterRatingOverlapDiagnostics: Array<{
    prestigeGap: number;
    actual: number;
    minimum?: number;
    maximum?: number;
  }>;
  balanceViolations: RecruitingBalanceViolation[];
  checksum: string;
  reproducibilityFailures: number;
  structuralViolations: string[];
  warnings: string[];
  aggregate: RecruitingEvaluationAggregate;
  runs: RecruitingEvaluationRun[];
}
