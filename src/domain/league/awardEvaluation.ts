import { AWARD_DEFINITIONS, type AwardSlug } from './awardDefinitions';
import type { AwardScoringSnapshot } from './awards';
import {
  AWARD_SCORING_CONFIG,
  AWARD_TUNING_CONTROLS,
  validateAwardScoringConfig,
  type AwardScoringConfig,
} from './awardScoringConfig';
import { checksumValues } from '../utils/checksum';

export type AwardEvaluationProfile = 'smoke' | 'iterate' | 'acceptance';
export type AwardEvaluationStatus = 'invalid' | 'needs_tuning' | 'ready_for_acceptance' | 'pass';

export const AWARD_EVALUATION_CHECKPOINTS = [3, 9, 12, 15] as const;

export interface AwardSeasonEvaluation {
  seed: number;
  season: number;
  year: number;
  checkpoints: Record<number, AwardScoringSnapshot>;
}

export interface AwardBalanceTarget {
  metric: string;
  minimum?: number;
  maximum?: number;
  sampleMinimum: number;
  rationale: string;
  control: 'heisman_impact_share' | 'nagurski_impact_share' | 'production_weight' | 'opportunity_gate' | 'score_weight' | 'team_rank_share' | 'team_award_concentration' | null;
  award?: AwardSlug;
}

const awardTargets = AWARD_DEFINITIONS.flatMap(definition => [
  {
    metric: `winner_primary_percentile.${definition.slug}`,
    minimum: 80,
    sampleMinimum: 20,
    rationale: 'Winners should rank among the strongest primary producers in their award pool.',
    control: 'production_weight' as const,
    award: definition.slug,
  },
  {
    metric: `final_eligible_candidates.${definition.slug}`,
    minimum: 20,
    sampleMinimum: 20,
    rationale: 'The final award race should have enough eligible candidates to be meaningful.',
    control: 'opportunity_gate' as const,
    award: definition.slug,
  },
  {
    metric: `candidate_score_spread.${definition.slug}`,
    minimum: 15,
    sampleMinimum: 20,
    rationale: 'Candidate scores should distinguish elite seasons from the rest of the pool.',
    control: 'score_weight' as const,
    award: definition.slug,
  },
  {
    metric: `winner_team_rank_percentile.${definition.slug}`,
    minimum: definition.slug === 'heisman' ? 90 : 75,
    sampleMinimum: 20,
    rationale: definition.slug === 'heisman'
      ? 'The Heisman winner should usually represent one of the strongest nationally ranked teams.'
      : 'Award winners should generally represent competitively strong nationally ranked teams.',
    control: 'team_rank_share' as const,
    award: definition.slug,
  },
]);

export const AWARD_BALANCE_TARGETS: AwardBalanceTarget[] = [
  { metric: 'minimum_heisman_winner_offensive_impact_percentile', minimum: 95, sampleMinimum: 20, rationale: 'Every Heisman winner should rank among the nationally elite cross-position offensive producers.', control: 'heisman_impact_share' },
  { metric: 'nagurski_bednarik_winner_overlap', minimum: 0.20, maximum: 0.80, sampleMinimum: 20, rationale: 'The two overall defensive awards should overlap sometimes without becoming duplicates.', control: 'nagurski_impact_share' },
  ...awardTargets,
  { metric: 'week_3_finalist_slot_fill_rate', minimum: 1, maximum: 1, sampleMinimum: 20, rationale: 'Every early award board should expose three viable finalists.', control: 'opportunity_gate' },
  { metric: 'final_winner_in_week_9_top_three_rate', minimum: 0.45, sampleMinimum: 20, rationale: 'Midseason standings should have meaningful predictive signal.', control: null },
  { metric: 'week_12_leader_retained_rate', minimum: 0.40, sampleMinimum: 20, rationale: 'Late-season leaders should win often without making races deterministic.', control: null },
  { metric: 'exact_first_place_tie_rate', maximum: 0.10, sampleMinimum: 20, rationale: 'Exact first-place ties should be uncommon.', control: 'score_weight' },
  { metric: 'mean_winner_runner_score_gap', minimum: 0.5, maximum: 30, sampleMinimum: 20, rationale: 'Award scores should separate winners without producing implausible blowouts.', control: 'score_weight' },
  { metric: 'mean_unique_winners', minimum: 7, maximum: 10, sampleMinimum: 20, rationale: 'Multiple-award winners should occur without collapsing twelve awards onto a few players.', control: null },
  { metric: 'largest_team_award_share', maximum: 0.20, sampleMinimum: 20, rationale: 'One team should not dominate the national award slate.', control: 'team_award_concentration' },
];

export interface AwardBalanceGap {
  metric: string;
  observed: number;
  target: { minimum?: number; maximum?: number };
  severity: number;
  evidence: string;
  control: AwardBalanceTarget['control'];
  award?: AwardSlug;
}

export interface AwardRecommendation {
  rank: number;
  configPath: string | null;
  direction: 'increase' | 'decrease' | 'escalate';
  suggestedDelta: number | null;
  bounds: { minimum: number; maximum: number } | null;
  companionPath?: string;
  companionDelta?: number;
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
  affectedMetrics: string[];
}

export interface AwardEvaluationSummary {
  contractVersion: 4;
  scoringConfigVersion: number;
  profile: AwardEvaluationProfile;
  representativeSample: boolean;
  seasons: number;
  checksum: string;
  replayChecksums: Array<{ seed: number; expected: string; actual: string; matches: boolean }>;
  status: AwardEvaluationStatus;
  exitCode: 0 | 1 | 2;
  structuralViolations: string[];
  metrics: Record<string, number>;
  gaps: AwardBalanceGap[];
  recommendations: AwardRecommendation[];
  nextCommand: string;
}

const mean = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.round((ordered.length - 1) * fraction)] ?? 0;
};
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

const checkpoint = (season: AwardSeasonEvaluation, week: number) => season.checkpoints[week];

const structuralViolations = (
  seasons: AwardSeasonEvaluation[],
  config: AwardScoringConfig,
) => {
  const violations = validateAwardScoringConfig(config);
  seasons.forEach(season => AWARD_EVALUATION_CHECKPOINTS.forEach(week => {
    const snapshot = checkpoint(season, week);
    if (!snapshot) {
      violations.push(`${season.seed}:${season.year}: missing Week ${week} snapshot`);
      return;
    }
    if (snapshot.awards.live.length !== AWARD_DEFINITIONS.length
      || snapshot.awards.final.length !== AWARD_DEFINITIONS.length) {
      violations.push(`${season.seed}:${season.year}: expected ${AWARD_DEFINITIONS.length} categories`);
    }
    AWARD_DEFINITIONS.forEach(definition => {
      const live = snapshot.awards.live.find(entry => entry.categorySlug === definition.slug);
      const final = snapshot.awards.final.find(entry => entry.categorySlug === definition.slug);
      const candidates = snapshot.candidates[definition.slug];
      if (!live || !final || live.placements.length !== 3 || final.placements.length !== 3) {
        violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}: invalid placements`);
        return;
      }
      if (JSON.stringify(live) !== JSON.stringify(final)) {
        violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}: live/final disagreement`);
      }
      candidates.forEach((candidate, index) => {
        if (!Number.isInteger(candidate.teamRank) || candidate.teamRank < 1
          || !Number.isFinite(candidate.teamRankPercentile)
          || candidate.teamRankPercentile < 0 || candidate.teamRankPercentile > 100) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: invalid team rank`);
        }
        const componentTotal = candidate.components.reduce((sum, component) => sum + component.contribution, 0);
        if (Math.abs(componentTotal - candidate.performanceScore) > 1e-8) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: component mismatch`);
        }
        if (definition.slug === 'nagurski') {
          const reproducedCore = candidate.performanceScore
            * (1 - config.nagurskiDefensiveImpactShare)
            + candidate.primaryProductionPercentile
            * config.nagurskiDefensiveImpactShare;
          if (Math.abs(reproducedCore - candidate.preTeamRankCoreScore) > 1e-8) {
            violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: award core mismatch`);
          }
        } else if (definition.slug === 'heisman') {
          const reproducedCore = candidate.performanceScore
            * (1 - config.heismanOffensiveImpactShare)
            + candidate.primaryProductionPercentile
            * config.heismanOffensiveImpactShare;
          if (candidate.heismanOffensiveImpact !== candidate.primaryProduction
            || candidate.heismanOffensiveImpactPercentile !== candidate.primaryProductionPercentile
            || candidate.heismanOffensiveImpactShare !== config.heismanOffensiveImpactShare
            || Math.abs(reproducedCore - candidate.preTeamRankCoreScore) > 1e-8) {
            violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: award core mismatch`);
          }
        } else if (Math.abs(candidate.performanceScore - candidate.preTeamRankCoreScore) > 1e-8) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: award core mismatch`);
        }
        const expectedRankShare = definition.slug === 'heisman'
          ? config.teamRankShares.heisman : config.teamRankShares.standard;
        const reproducedCore = candidate.preTeamRankCoreScore * (1 - expectedRankShare)
          + candidate.teamRankPercentile * expectedRankShare;
        if (candidate.teamRankShare !== expectedRankShare
          || Math.abs(reproducedCore - candidate.coreScore) > 1e-8) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: rank blend mismatch`);
        }
        const reproducedScore = Math.max(0, Math.min(100,
          candidate.coreScore * (1 - candidate.ratingPriorShare)
          + candidate.ratingPercentile * candidate.ratingPriorShare,
        ));
        if (Math.abs(reproducedScore - candidate.finalScore) > 1e-8) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: blend mismatch`);
        }
        if (!Number.isFinite(candidate.finalScore) || candidate.finalScore < 0 || candidate.finalScore > 100) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}:${candidate.playerId}: invalid score`);
        }
        if (index && candidates[index - 1].finalScore < candidate.finalScore) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}: diagnostics out of order`);
        }
      });
      live.placements.forEach((placement, index) => {
        const candidate = candidates[index];
        if ((placement.player?.id ?? null) !== (candidate?.playerId ?? null)
          || placement.score !== (candidate?.finalScore ?? null)) {
          violations.push(`${season.seed}:${season.year}:${week}:${definition.slug}: display mismatch`);
        }
      });
    });
  }));
  return [...new Set(violations)];
};

export const calculateAwardMetrics = (seasons: AwardSeasonEvaluation[]) => {
  const metrics: Record<string, number> = {};
  const finalHeismanWinners = seasons.map(season => checkpoint(season, 15).candidates.heisman[0]).filter(Boolean);
  metrics.heisman_qb_winner_share = mean(finalHeismanWinners.map(winner => winner.position === 'qb' ? 1 : 0));
  metrics.heisman_rb_winner_share = mean(finalHeismanWinners.map(winner => winner.position === 'rb' ? 1 : 0));
  metrics.heisman_receiver_winner_share = mean(finalHeismanWinners.map(winner => winner.position === 'wr' || winner.position === 'te' ? 1 : 0));
  metrics.minimum_heisman_winner_offensive_impact_percentile = finalHeismanWinners.length
    ? Math.min(...finalHeismanWinners.map(winner => winner.heismanOffensiveImpactPercentile ?? 0))
    : 0;
  metrics.nagurski_bednarik_winner_overlap = mean(seasons.flatMap(season => {
    const nagurski = checkpoint(season, 15).candidates.nagurski[0]?.playerId;
    const bednarik = checkpoint(season, 15).candidates.bednarik[0]?.playerId;
    return nagurski === undefined || bednarik === undefined
      ? [] : [nagurski === bednarik ? 1 : 0];
  }));

  AWARD_DEFINITIONS.forEach(definition => {
    const pools = seasons.map(season => checkpoint(season, 15).candidates[definition.slug]);
    const winners = pools.map(pool => pool[0]).filter(Boolean);
    metrics[`winner_primary_percentile.${definition.slug}`] = percentile(
      winners.map(winner => winner.primaryProductionPercentile), 0.5,
    );
    metrics[`winner_team_rank_percentile.${definition.slug}`] = percentile(
      winners.map(winner => winner.teamRankPercentile), 0.5,
    );
    metrics[`final_eligible_candidates.${definition.slug}`] = Math.min(...pools.map(pool => pool.length));
    const scores = pools.flatMap(pool => pool.map(candidate => candidate.finalScore));
    metrics[`candidate_score_spread.${definition.slug}`] = percentile(scores, 0.9) - percentile(scores, 0.1);
    metrics[`week_3_slot_fill_rate.${definition.slug}`] = mean(seasons.map(season =>
      Math.min(3, checkpoint(season, 3).candidates[definition.slug].length) / 3));
    metrics[`first_place_tie_rate.${definition.slug}`] = mean(pools.map(pool =>
      pool.length > 1 && pool[0].finalScore === pool[1].finalScore ? 1 : 0));
    metrics[`winner_runner_gap.${definition.slug}`] = mean(pools.map(pool =>
      pool.length > 1 ? pool[0].finalScore - pool[1].finalScore : 0));
  });

  const totalSlots = seasons.length * AWARD_DEFINITIONS.length * 3;
  const filledSlots = seasons.reduce((total, season) => total + AWARD_DEFINITIONS.reduce(
    (awardTotal, definition) => awardTotal + Math.min(3, checkpoint(season, 3).candidates[definition.slug].length), 0,
  ), 0);
  metrics.week_3_finalist_slot_fill_rate = totalSlots ? filledSlots / totalSlots : 0;
  const awardSeasonPairs = seasons.flatMap(season => AWARD_DEFINITIONS.map(definition => ({ season, slug: definition.slug })));
  metrics.final_winner_in_week_9_top_three_rate = mean(awardSeasonPairs.map(({ season, slug }) => {
    const winner = checkpoint(season, 15).candidates[slug][0]?.playerId;
    return checkpoint(season, 9).candidates[slug].slice(0, 3).some(candidate => candidate.playerId === winner) ? 1 : 0;
  }));
  metrics.week_12_leader_retained_rate = mean(awardSeasonPairs.map(({ season, slug }) =>
    checkpoint(season, 12).candidates[slug][0]?.playerId === checkpoint(season, 15).candidates[slug][0]?.playerId ? 1 : 0));
  metrics.exact_first_place_tie_rate = mean(awardSeasonPairs.map(({ season, slug }) => {
    const candidates = checkpoint(season, 15).candidates[slug];
    return candidates.length > 1 && candidates[0].finalScore === candidates[1].finalScore ? 1 : 0;
  }));
  metrics.mean_winner_runner_score_gap = mean(awardSeasonPairs.map(({ season, slug }) => {
    const candidates = checkpoint(season, 15).candidates[slug];
    return candidates.length > 1 ? candidates[0].finalScore - candidates[1].finalScore : 0;
  }));
  metrics.mean_unique_winners = mean(seasons.map(season => new Set(AWARD_DEFINITIONS.map(
    definition => checkpoint(season, 15).candidates[definition.slug][0]?.playerId,
  ).filter(id => id !== undefined)).size));
  const teamAwards = new Map<number, number>();
  awardSeasonPairs.forEach(({ season, slug }) => {
    const teamId = checkpoint(season, 15).candidates[slug][0]?.teamId;
    if (teamId !== undefined) teamAwards.set(teamId, (teamAwards.get(teamId) ?? 0) + 1);
  });
  metrics.largest_team_award_share = awardSeasonPairs.length
    ? Math.max(0, ...teamAwards.values()) / awardSeasonPairs.length : 0;
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, round(value)]));
};

export const evaluateAwardBalance = (metrics: Record<string, number>): AwardBalanceGap[] =>
  AWARD_BALANCE_TARGETS.flatMap(target => {
    const observed = metrics[target.metric];
    if (!Number.isFinite(observed)) return [];
    const below = target.minimum !== undefined && observed < target.minimum;
    const above = target.maximum !== undefined && observed > target.maximum;
    if (!below && !above) return [];
    const distance = below ? target.minimum! - observed : observed - target.maximum!;
    const scale = Math.max(0.01, (target.maximum ?? target.minimum ?? 1) - (target.minimum ?? 0));
    let award = target.award;
    if (!award && target.metric === 'week_3_finalist_slot_fill_rate') {
      award = [...AWARD_DEFINITIONS].sort((left, right) =>
        (metrics[`week_3_slot_fill_rate.${left.slug}`] ?? observed)
        - (metrics[`week_3_slot_fill_rate.${right.slug}`] ?? observed),
      )[0].slug;
    } else if (!award && target.metric === 'exact_first_place_tie_rate') {
      award = [...AWARD_DEFINITIONS].sort((left, right) =>
        (metrics[`first_place_tie_rate.${right.slug}`] ?? 0)
        - (metrics[`first_place_tie_rate.${left.slug}`] ?? 0),
      )[0].slug;
    } else if (!award && target.metric === 'mean_winner_runner_score_gap') {
      const selectLargest = target.maximum !== undefined && observed > target.maximum;
      award = [...AWARD_DEFINITIONS].sort((left, right) => {
        const difference = (metrics[`winner_runner_gap.${left.slug}`] ?? observed)
          - (metrics[`winner_runner_gap.${right.slug}`] ?? observed);
        return selectLargest ? -difference : difference;
      })[0].slug;
    }
    return [{
      metric: target.metric,
      observed,
      target: { minimum: target.minimum, maximum: target.maximum },
      severity: round(distance / scale),
      evidence: `${target.metric} observed ${observed}; target ${target.minimum ?? '-∞'}–${target.maximum ?? '∞'}. ${target.rationale}`,
      control: target.control,
      award,
    }];
  }).sort((left, right) => right.severity - left.severity || left.metric.localeCompare(right.metric));

const awardControl = (award: AwardSlug | undefined, control: AwardBalanceTarget['control']) => {
  const map: Record<AwardSlug, { gate: string; weight: string; companion: string }> = {
    heisman: { gate: 'eligibility.receiverCatchesPerGame', weight: 'metricWeights.receiver.receivingYardsPerGame', companion: 'metricWeights.receiver.yardsPerCatch' },
    maxwell: { gate: 'eligibility.receiverCatchesPerGame', weight: 'metricWeights.receiver.receivingYardsPerGame', companion: 'metricWeights.receiver.yardsPerCatch' },
    davey_obrien: { gate: 'eligibility.quarterbackPassAttemptsPerGame', weight: 'metricWeights.quarterback.totalOffenseYardsPerGame', companion: 'metricWeights.quarterback.completionRate' },
    doak_walker: { gate: 'eligibility.runningBackTouchesPerGame', weight: 'metricWeights.runningBack.scrimmageYardsPerGame', companion: 'metricWeights.runningBack.inverseFumblesPerTouch' },
    biletnikoff: { gate: 'eligibility.receiverCatchesPerGame', weight: 'metricWeights.receiver.receivingYardsPerGame', companion: 'metricWeights.receiver.yardsPerCatch' },
    mackey: { gate: 'eligibility.receiverCatchesPerGame', weight: 'metricWeights.receiver.receivingYardsPerGame', companion: 'metricWeights.receiver.yardsPerCatch' },
    bednarik: { gate: 'eligibility.defenderEventsPerGame', weight: 'metricWeights.linebacker.tacklesPerGame', companion: 'metricWeights.linebacker.recoveriesPerGame' },
    nagurski: { gate: 'eligibility.defenderEventsPerGame', weight: 'metricWeights.linebacker.tacklesPerGame', companion: 'metricWeights.linebacker.recoveriesPerGame' },
    ted_hendricks: { gate: 'eligibility.defenderEventsPerGame', weight: 'metricWeights.defensiveLine.sacksPerGame', companion: 'metricWeights.defensiveLine.recoveriesPerGame' },
    butkus: { gate: 'eligibility.defenderEventsPerGame', weight: 'metricWeights.linebacker.tacklesPerGame', companion: 'metricWeights.linebacker.recoveriesPerGame' },
    thorpe: { gate: 'eligibility.defenderEventsPerGame', weight: 'metricWeights.defensiveBack.interceptionsPerGame', companion: 'metricWeights.defensiveBack.tacklesPerGame' },
    lou_groza: { gate: 'eligibility.kickerFieldGoalAttemptsPerGame', weight: 'metricWeights.kicker.fieldGoalsMadePerGame', companion: 'metricWeights.kicker.extraPointAccuracy' },
  };
  if (!award) return null;
  return control === 'opportunity_gate' ? { path: map[award].gate } : { path: map[award].weight, companion: map[award].companion };
};

const currentValue = (config: AwardScoringConfig, path: string) => path.split('.').reduce<unknown>(
  (value, segment) => typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[segment] : undefined,
  config,
) as number;

export const buildAwardRecommendations = (
  gaps: AwardBalanceGap[],
  config: AwardScoringConfig,
  representativeSample: boolean,
): AwardRecommendation[] => {
  const standardRankGaps = gaps.filter(gap =>
    gap.control === 'team_rank_share' && gap.award !== 'heisman');
  const concentrationGaps = gaps.filter(gap => gap.control === 'team_award_concentration');
  const groupedMetrics = new Map<string, string[]>();
  let effectiveGaps = [...gaps];
  if (standardRankGaps.length && concentrationGaps.length) {
    const related = new Set([...standardRankGaps, ...concentrationGaps]);
    const conflict: AwardBalanceGap = {
      metric: 'team_rank_control_conflict',
      observed: config.teamRankShares.standard,
      target: {},
      severity: Math.max(...[...related].map(gap => gap.severity)),
      evidence: `${standardRankGaps.map(gap => gap.evidence).join(' ')} ${concentrationGaps.map(gap => gap.evidence).join(' ')} Increasing team-rank bias conflicts with the team-concentration guardrail.`,
      control: null,
    };
    groupedMetrics.set(conflict.metric, [...related].map(gap => gap.metric));
    effectiveGaps = [...effectiveGaps.filter(gap => !related.has(gap)), conflict]
      .sort((left, right) => right.severity - left.severity || left.metric.localeCompare(right.metric));
  } else if (standardRankGaps.length > 1) {
    const representative = standardRankGaps[0];
    const affectedAwards = standardRankGaps.map(gap => gap.award).filter(Boolean).join(', ');
    const aggregate = {
      ...representative,
      evidence: `${standardRankGaps.map(gap => gap.evidence).join(' ')} Affected standard awards: ${affectedAwards}.`,
    };
    groupedMetrics.set(aggregate.metric, standardRankGaps.map(gap => gap.metric));
    const related = new Set(standardRankGaps);
    effectiveGaps = [...effectiveGaps.filter(gap => !related.has(gap)), aggregate]
      .sort((left, right) => right.severity - left.severity || left.metric.localeCompare(right.metric));
  }

  const recommendations: AwardRecommendation[] = effectiveGaps.map((gap): AwardRecommendation => {
    const gapMetrics = groupedMetrics.get(gap.metric) ?? [gap.metric];
    let selected: { path: string; companion?: string } | null = null;
    let direction: AwardRecommendation['direction'] = 'increase';
    if (gap.control === 'heisman_impact_share') {
      selected = { path: 'heismanOffensiveImpactShare' };
      direction = 'increase';
    } else if (gap.control === 'nagurski_impact_share') {
      selected = { path: 'nagurskiDefensiveImpactShare' };
      direction = gap.target.maximum !== undefined && gap.observed > gap.target.maximum
        ? 'increase' : 'decrease';
    } else if (gap.control === 'opportunity_gate') {
      selected = awardControl(gap.award, gap.control);
      direction = 'decrease';
    } else if (gap.control === 'production_weight' || gap.control === 'score_weight') {
      selected = awardControl(gap.award, gap.control);
      direction = gap.metric === 'mean_winner_runner_score_gap'
        && gap.target.maximum !== undefined && gap.observed > gap.target.maximum
        ? 'decrease' : 'increase';
    } else if (gap.control === 'team_rank_share') {
      selected = {
        path: gap.award === 'heisman'
          ? 'teamRankShares.heisman' : 'teamRankShares.standard',
      };
      direction = 'increase';
    } else if (gap.control === 'team_award_concentration') {
      selected = { path: 'teamRankShares.standard' };
      direction = 'decrease';
    }
    if (!selected) return {
      rank: 0,
      configPath: null,
      direction: 'escalate',
      suggestedDelta: null,
      bounds: null,
      evidence: `${gap.evidence} No approved tunable control maps causally to this gap; do not edit locked product rules.`,
      confidence: representativeSample ? 'high' : 'low',
      affectedMetrics: gapMetrics,
    };
    const control = AWARD_TUNING_CONTROLS.find(item => item.path === selected.path)!;
    const value = currentValue(config, selected.path);
    let maximumDelta = direction === 'increase'
      ? Math.min(control.maximum - value, control.maximumDelta)
      : Math.min(value - control.minimum, control.maximumDelta);
    if (selected.companion) {
      const companionControl = AWARD_TUNING_CONTROLS.find(item =>
        item.path === selected!.companion,
      )!;
      const companionValue = currentValue(config, selected.companion);
      maximumDelta = Math.min(maximumDelta, direction === 'increase'
        ? companionValue - companionControl.minimum
        : companionControl.maximum - companionValue);
    }
    let rankCompanionDelta = 0;
    if (selected.path === 'teamRankShares.standard' && direction === 'increase') {
      const heismanControl = AWARD_TUNING_CONTROLS.find(item =>
        item.path === 'teamRankShares.heisman')!;
      const heismanValue = config.teamRankShares.heisman;
      maximumDelta = Math.min(
        maximumDelta,
        heismanValue + Math.min(heismanControl.maximum - heismanValue, heismanControl.maximumDelta)
          - 0.05 - value,
      );
      rankCompanionDelta = Math.max(0, value + maximumDelta + 0.05 - heismanValue);
    }
    if (maximumDelta <= 0) return {
      rank: 0,
      configPath: null,
      direction: 'escalate',
      suggestedDelta: null,
      bounds: null,
      evidence: `${gap.evidence} ${selected.path} is already at its approved ${direction} bound; do not edit locked rules or exceed configured bounds.`,
      confidence: representativeSample ? 'high' : 'medium',
      affectedMetrics: gapMetrics,
    };
    const delta = round(direction === 'increase' ? maximumDelta : -maximumDelta);
    return {
      rank: 0,
      configPath: selected.path,
      direction,
      suggestedDelta: Math.abs(delta),
      bounds: { minimum: control.minimum, maximum: control.maximum },
      ...(selected.companion ? {
        companionPath: selected.companion,
        companionDelta: -delta,
      } : rankCompanionDelta > 1e-9 ? {
        companionPath: 'teamRankShares.heisman',
        companionDelta: round(rankCompanionDelta),
      } : {}),
      evidence: `${gap.evidence} Current ${selected.path}=${value}.`,
      confidence: representativeSample ? 'high' : 'medium',
      affectedMetrics: [...new Set([...gapMetrics, ...control.affects])],
    };
  });
  const confidenceOrder = { high: 0, medium: 1, low: 2 } as const;
  const recommendationOrder = new Map(effectiveGaps.flatMap((gap, index) =>
    (groupedMetrics.get(gap.metric) ?? [gap.metric]).map(metric => [metric, index] as const)));
  return recommendations.sort((left, right) =>
    Number(left.configPath === null) - Number(right.configPath === null)
    || confidenceOrder[left.confidence] - confidenceOrder[right.confidence]
    || (recommendationOrder.get(left.affectedMetrics[0]) ?? 0)
      - (recommendationOrder.get(right.affectedMetrics[0]) ?? 0),
  ).slice(0, 5).map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
};

export const awardEvaluationExitCode = (
  profile: AwardEvaluationProfile,
  structural: readonly unknown[],
  replayMatches: boolean,
  gaps: readonly unknown[],
): 0 | 1 | 2 => structural.length || !replayMatches ? 1 : profile === 'acceptance' && gaps.length ? 2 : 0;

export const awardEvaluationStatus = (
  profile: AwardEvaluationProfile,
  exitCode: 0 | 1 | 2,
  gaps: readonly unknown[],
  actionableTuning = gaps.length > 0,
): AwardEvaluationStatus => exitCode === 1 ? 'invalid'
  : profile === 'acceptance' ? gaps.length ? 'needs_tuning' : 'pass'
    : actionableTuning ? 'needs_tuning' : 'ready_for_acceptance';

export const awardEvaluationNextCommand = (
  profile: AwardEvaluationProfile,
  status: AwardEvaluationStatus,
) => status === 'invalid' ? 'npm run eval:awards -- --profile smoke'
  : status === 'needs_tuning' ? `npm run eval:awards -- --profile ${profile}`
    : status === 'ready_for_acceptance' ? 'npm run eval:awards -- --profile acceptance'
      : 'npm test && npm run typecheck && npm run build';

export const evaluateAwards = ({
  profile,
  seasons,
  replayChecksums = [],
  config = AWARD_SCORING_CONFIG,
}: {
  profile: AwardEvaluationProfile;
  seasons: AwardSeasonEvaluation[];
  replayChecksums?: AwardEvaluationSummary['replayChecksums'];
  config?: AwardScoringConfig;
}): AwardEvaluationSummary => {
  const structural = structuralViolations(seasons, config);
  const metrics = calculateAwardMetrics(seasons);
  const gaps = profile === 'smoke' ? [] : evaluateAwardBalance(metrics);
  const representativeSample = profile === 'acceptance' && seasons.length >= 20;
  const replayMatches = replayChecksums.every(replay => replay.matches);
  const exitCode = awardEvaluationExitCode(profile, structural, replayMatches, gaps);
  const recommendations = buildAwardRecommendations(gaps, config, representativeSample);
  const status = awardEvaluationStatus(
    profile,
    exitCode,
    gaps,
    recommendations.some(recommendation => recommendation.configPath !== null),
  );
  const checksum = checksumValues(seasons.map(season => ({
    seed: season.seed,
    season: season.season,
    year: season.year,
    final: AWARD_DEFINITIONS.map(definition => season.checkpoints[15].candidates[definition.slug].slice(0, 3)
      .map(candidate => [candidate.playerId, candidate.finalScore])),
  })));
  const nextCommand = awardEvaluationNextCommand(profile, status);
  return {
    contractVersion: 4,
    scoringConfigVersion: config.version,
    profile,
    representativeSample,
    seasons: seasons.length,
    checksum,
    replayChecksums,
    status,
    exitCode,
    structuralViolations: structural,
    metrics,
    gaps,
    recommendations,
    nextCommand,
  };
};
