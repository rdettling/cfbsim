export type AwardScoringCohort =
  | 'quarterback'
  | 'runningBack'
  | 'receiver'
  | 'defensiveLine'
  | 'linebacker'
  | 'defensiveBack'
  | 'kicker';

export type AwardMetricKey =
  | 'totalOffenseYardsPerGame'
  | 'totalTouchdownsPerGame'
  | 'adjustedPassYardsPerAttempt'
  | 'completionRate'
  | 'inverseGiveawaysPerGame'
  | 'scrimmageYardsPerGame'
  | 'rushingYardsPerGame'
  | 'yardsPerCarry'
  | 'inverseFumblesPerTouch'
  | 'receivingYardsPerGame'
  | 'receivingTouchdownsPerGame'
  | 'catchesPerGame'
  | 'yardsPerCatch'
  | 'sacksPerGame'
  | 'tacklesPerGame'
  | 'forcedFumblesPerGame'
  | 'recoveriesPerGame'
  | 'interceptionsPerGame'
  | 'fieldGoalsMadePerGame'
  | 'fieldGoalAccuracy'
  | 'extraPointAccuracy';

export interface AwardScoringConfig {
  version: 4;
  eligibility: {
    quarterbackPassAttemptsPerGame: number;
    runningBackTouchesPerGame: number;
    receiverCatchesPerGame: number;
    defenderEventsPerGame: number;
    kickerFieldGoalAttemptsPerGame: number;
  };
  metricWeights: Record<AwardScoringCohort, Partial<Record<AwardMetricKey, number>>>;
  heismanOffensiveImpactShare: number;
  teamRankShares: {
    standard: number;
    heisman: number;
  };
  nagurskiDefensiveImpactShare: number;
}

export const AWARD_SCORING_POLICY = Object.freeze({
  eligibleGameTypes: ['regular_season', 'conference_championship'] as const,
  ratingPriorByGames: [0, 0.20, 0.16, 0.12, 0.08, 0.04, 0] as const,
  heismanPositions: ['qb', 'rb', 'wr', 'te'] as const,
  multipleAwardWinnersAllowed: true,
});

export const AWARD_SCORING_CONFIG: AwardScoringConfig = {
  version: 4,
  eligibility: {
    quarterbackPassAttemptsPerGame: 12,
    runningBackTouchesPerGame: 5,
    receiverCatchesPerGame: 1.5,
    defenderEventsPerGame: 1,
    kickerFieldGoalAttemptsPerGame: 0.5,
  },
  metricWeights: {
    quarterback: {
      totalOffenseYardsPerGame: 0.30,
      totalTouchdownsPerGame: 0.25,
      adjustedPassYardsPerAttempt: 0.20,
      completionRate: 0.15,
      inverseGiveawaysPerGame: 0.10,
    },
    runningBack: {
      scrimmageYardsPerGame: 0.35,
      rushingYardsPerGame: 0.20,
      yardsPerCarry: 0.15,
      totalTouchdownsPerGame: 0.20,
      inverseFumblesPerTouch: 0.10,
    },
    receiver: {
      receivingYardsPerGame: 0.40,
      receivingTouchdownsPerGame: 0.25,
      catchesPerGame: 0.20,
      yardsPerCatch: 0.15,
    },
    defensiveLine: {
      sacksPerGame: 0.40,
      tacklesPerGame: 0.25,
      forcedFumblesPerGame: 0.20,
      recoveriesPerGame: 0.15,
    },
    linebacker: {
      tacklesPerGame: 0.35,
      sacksPerGame: 0.20,
      interceptionsPerGame: 0.20,
      forcedFumblesPerGame: 0.15,
      recoveriesPerGame: 0.10,
    },
    defensiveBack: {
      interceptionsPerGame: 0.40,
      tacklesPerGame: 0.20,
      forcedFumblesPerGame: 0.20,
      recoveriesPerGame: 0.20,
    },
    kicker: {
      fieldGoalsMadePerGame: 0.50,
      fieldGoalAccuracy: 0.40,
      extraPointAccuracy: 0.10,
    },
  },
  heismanOffensiveImpactShare: 0.50,
  teamRankShares: {
    standard: 0.10,
    heisman: 0.15,
  },
  nagurskiDefensiveImpactShare: 0.30,
};

export interface AwardTuningControl {
  path: string;
  minimum: number;
  maximum: number;
  maximumDelta: number;
  affects: string[];
}

const eligibilityControls: AwardTuningControl[] = [
  ['quarterbackPassAttemptsPerGame', 8, 20, 2],
  ['runningBackTouchesPerGame', 3, 10, 1],
  ['receiverCatchesPerGame', 1, 3, 0.5],
  ['defenderEventsPerGame', 0.5, 2, 0.25],
  ['kickerFieldGoalAttemptsPerGame', 0.25, 1, 0.25],
].map(([key, minimum, maximum, maximumDelta]) => ({
  path: `eligibility.${key}`,
  minimum: minimum as number,
  maximum: maximum as number,
  maximumDelta: maximumDelta as number,
  affects: ['candidate_availability'],
}));

const weightControls = Object.entries(AWARD_SCORING_CONFIG.metricWeights).flatMap(
  ([cohort, weights]) => Object.keys(weights).map(metric => ({
    path: `metricWeights.${cohort}.${metric}`,
    minimum: 0.05,
    maximum: 0.60,
    maximumDelta: 0.05,
    affects: ['production_quality', 'score_spread'],
  })),
);

export const AWARD_TUNING_CONTROLS: AwardTuningControl[] = [
  ...eligibilityControls,
  ...weightControls,
  {
    path: 'heismanOffensiveImpactShare',
    minimum: 0.30,
    maximum: 0.70,
    maximumDelta: 0.05,
    affects: ['minimum_heisman_winner_offensive_impact_percentile'],
  },
  {
    path: 'teamRankShares.standard',
    minimum: 0.025,
    maximum: 0.15,
    maximumDelta: 0.025,
    affects: ['winner_team_rank_percentile', 'largest_team_award_share'],
  },
  {
    path: 'teamRankShares.heisman',
    minimum: 0.10,
    maximum: 0.25,
    maximumDelta: 0.025,
    affects: ['winner_team_rank_percentile.heisman'],
  },
  {
    path: 'nagurskiDefensiveImpactShare',
    minimum: 0.20,
    maximum: 0.40,
    maximumDelta: 0.05,
    affects: ['nagurski_bednarik_winner_overlap'],
  },
];

export const validateAwardScoringConfig = (config: AwardScoringConfig): string[] => {
  const errors: string[] = [];
  if (config.version !== 4) errors.push('version must equal 4');
  AWARD_TUNING_CONTROLS.forEach(control => {
    const value = control.path.split('.').reduce<unknown>((current, segment) =>
      typeof current === 'object' && current !== null
        ? (current as Record<string, unknown>)[segment]
        : undefined, config);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${control.path} must be finite`);
    } else if (value < control.minimum || value > control.maximum) {
      errors.push(`${control.path} must be between ${control.minimum} and ${control.maximum}`);
    }
  });
  Object.entries(config.metricWeights).forEach(([cohort, weights]) => {
    const sum = Object.values(weights).reduce((total, weight) => total + (weight ?? 0), 0);
    if (Math.abs(sum - 1) > 1e-9) errors.push(`metricWeights.${cohort} must sum to 1`);
  });
  if (Number.isFinite(config.teamRankShares.standard)
    && Number.isFinite(config.teamRankShares.heisman)
    && config.teamRankShares.heisman - config.teamRankShares.standard < 0.05 - 1e-9) {
    errors.push('teamRankShares.heisman must be at least 0.05 greater than teamRankShares.standard');
  }
  return errors;
};
