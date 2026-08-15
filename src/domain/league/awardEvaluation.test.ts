import { describe, expect, it } from 'vitest';
import { buildTestLeague } from '../../test/fixtures';
import { buildAwardScoringSnapshot } from './awards';
import {
  awardEvaluationNextCommand,
  awardEvaluationStatus,
  buildAwardRecommendations,
  evaluateAwardBalance,
  evaluateAwards,
  type AwardBalanceGap,
  type AwardSeasonEvaluation,
} from './awardEvaluation';
import { AWARD_SCORING_CONFIG } from './awardScoringConfig';

const emptySnapshot = buildAwardScoringSnapshot(buildTestLeague('season'), [], [], []);
const season = (seed: number, index: number): AwardSeasonEvaluation => ({
  seed,
  season: index,
  year: 2026 + index,
  checkpoints: { 3: emptySnapshot, 9: emptySnapshot, 12: emptySnapshot, 15: emptySnapshot },
});

describe('award balance evaluation', () => {
  it('defines every status and next-command transition', () => {
    expect(awardEvaluationStatus('smoke', 1, [])).toBe('invalid');
    expect(awardEvaluationStatus('iterate', 0, [{}])).toBe('needs_tuning');
    expect(awardEvaluationStatus('iterate', 0, [{}], false)).toBe('ready_for_acceptance');
    expect(awardEvaluationStatus('iterate', 0, [])).toBe('ready_for_acceptance');
    expect(awardEvaluationStatus('acceptance', 0, [])).toBe('pass');
    expect(awardEvaluationNextCommand('iterate', 'needs_tuning'))
      .toBe('npm run eval:awards -- --profile iterate');
    expect(awardEvaluationNextCommand('iterate', 'ready_for_acceptance'))
      .toBe('npm run eval:awards -- --profile acceptance');
    expect(awardEvaluationNextCommand('acceptance', 'pass'))
      .toBe('npm test && npm run typecheck && npm run build');
  });

  it('uses profile-specific statuses and exit codes for the same balance failures', () => {
    const smoke = evaluateAwards({ profile: 'smoke', seasons: [season(1, 0)] });
    expect(smoke).toEqual(expect.objectContaining({ status: 'ready_for_acceptance', exitCode: 0, gaps: [] }));

    const iteration = evaluateAwards({
      profile: 'iterate',
      seasons: Array.from({ length: 6 }, (_, index) => season(index, index)),
    });
    expect(iteration.status).toBe('needs_tuning');
    expect(iteration.exitCode).toBe(0);
    expect(iteration.gaps.length).toBeGreaterThan(0);

    const acceptance = evaluateAwards({
      profile: 'acceptance',
      seasons: Array.from({ length: 20 }, (_, index) => season(index, index)),
    });
    expect(acceptance).toEqual(expect.objectContaining({
      status: 'needs_tuning',
      exitCode: 2,
      representativeSample: true,
    }));
  });

  it('treats replay mismatches as structural failures', () => {
    const result = evaluateAwards({
      profile: 'acceptance',
      seasons: [season(1, 0)],
      replayChecksums: [{ seed: 1, expected: 'a', actual: 'b', matches: false }],
    });
    expect(result.status).toBe('invalid');
    expect(result.exitCode).toBe(1);
  });

  it('ranks gaps and emits bounded approved edits or explicit escalations', () => {
    const metrics = Object.fromEntries([
      ['minimum_heisman_winner_offensive_impact_percentile', 80],
      ['final_winner_in_week_9_top_three_rate', 0.2],
    ]);
    const gaps = evaluateAwardBalance(metrics);
    expect(gaps[0].severity).toBeGreaterThanOrEqual(gaps[gaps.length - 1].severity);
    const recommendations = buildAwardRecommendations(gaps, AWARD_SCORING_CONFIG, true);
    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        configPath: 'heismanOffensiveImpactShare',
        direction: 'increase',
        suggestedDelta: 0.05,
        confidence: 'high',
      }),
      expect.objectContaining({ configPath: null, direction: 'escalate' }),
    ]));
  });

  it('reports Heisman position shares without turning them into gaps or recommendations', () => {
    const gaps = evaluateAwardBalance({
      heisman_qb_winner_share: 0,
      heisman_rb_winner_share: 0,
      heisman_receiver_winner_share: 1,
    });
    expect(gaps).toEqual([]);
    expect(buildAwardRecommendations(gaps, AWARD_SCORING_CONFIG, true)).toEqual([]);
  });

  it('maps low Heisman cross-position production only to the bounded impact share', () => {
    const [gap] = evaluateAwardBalance({
      minimum_heisman_winner_offensive_impact_percentile: 90,
    });
    expect(buildAwardRecommendations([gap], AWARD_SCORING_CONFIG, true)[0])
      .toEqual(expect.objectContaining({
        configPath: 'heismanOffensiveImpactShare',
        direction: 'increase',
        suggestedDelta: 0.05,
        bounds: { minimum: 0.30, maximum: 0.70 },
        affectedMetrics: expect.arrayContaining([
          'minimum_heisman_winner_offensive_impact_percentile',
        ]),
      }));

    const atBound = structuredClone(AWARD_SCORING_CONFIG);
    atBound.heismanOffensiveImpactShare = 0.70;
    expect(buildAwardRecommendations([gap], atBound, true)[0])
      .toEqual(expect.objectContaining({ configPath: null, direction: 'escalate' }));
  });

  it('keeps weight recommendations sum-safe by naming a companion edit', () => {
    const gap: AwardBalanceGap = {
      metric: 'winner_primary_percentile.doak_walker',
      observed: 60,
      target: { minimum: 80 },
      severity: 0.25,
      evidence: 'fixture',
      control: 'production_weight',
      award: 'doak_walker',
    };
    expect(buildAwardRecommendations([gap], AWARD_SCORING_CONFIG, false)[0])
      .toEqual(expect.objectContaining({
        configPath: 'metricWeights.runningBack.scrimmageYardsPerGame',
        companionPath: 'metricWeights.runningBack.inverseFumblesPerTouch',
        companionDelta: -0.05,
      }));
  });

  it('maps aggregate availability gaps to the cohort with the weakest fill rate', () => {
    const metrics: Record<string, number> = { week_3_finalist_slot_fill_rate: 0.9 };
    ['heisman', 'maxwell', 'davey_obrien', 'doak_walker', 'biletnikoff', 'mackey',
      'bednarik', 'nagurski', 'ted_hendricks', 'butkus', 'thorpe', 'lou_groza'].forEach(slug => {
      metrics[`week_3_slot_fill_rate.${slug}`] = 1;
    });
    metrics['week_3_slot_fill_rate.lou_groza'] = 0.5;
    const [gap] = evaluateAwardBalance(metrics);
    expect(gap.award).toBe('lou_groza');
    expect(buildAwardRecommendations([gap], AWARD_SCORING_CONFIG, true)[0])
      .toEqual(expect.objectContaining({
        configPath: 'eligibility.kickerFieldGoalAttemptsPerGame',
        direction: 'decrease',
      }));
  });

  it('uses the bounded Nagurski impact share to address excessive award overlap', () => {
    const gap: AwardBalanceGap = {
      metric: 'nagurski_bednarik_winner_overlap',
      observed: 0.95,
      target: { minimum: 0.20, maximum: 0.80 },
      severity: 0.25,
      evidence: 'fixture',
      control: 'nagurski_impact_share',
    };
    expect(buildAwardRecommendations([gap], AWARD_SCORING_CONFIG, true)[0])
      .toEqual(expect.objectContaining({
        configPath: 'nagurskiDefensiveImpactShare',
        direction: 'increase',
        suggestedDelta: 0.05,
        bounds: { minimum: 0.20, maximum: 0.40 },
      }));

    const atBound = structuredClone(AWARD_SCORING_CONFIG);
    atBound.nagurskiDefensiveImpactShare = 0.40;
    expect(buildAwardRecommendations([gap], atBound, true)[0])
      .toEqual(expect.objectContaining({
        configPath: null,
        direction: 'escalate',
      }));
  });

  it('maps Heisman rank quality to its dedicated bounded share', () => {
    const [gap] = evaluateAwardBalance({
      'winner_team_rank_percentile.heisman': 80,
    });
    expect(buildAwardRecommendations([gap], AWARD_SCORING_CONFIG, true)[0])
      .toEqual(expect.objectContaining({
        configPath: 'teamRankShares.heisman',
        direction: 'increase',
        suggestedDelta: 0.025,
        bounds: { minimum: 0.10, maximum: 0.25 },
      }));
  });

  it('aggregates standard-award rank gaps into one causal recommendation', () => {
    const gaps = evaluateAwardBalance({
      'winner_team_rank_percentile.maxwell': 60,
      'winner_team_rank_percentile.butkus': 65,
    });
    const recommendations = buildAwardRecommendations(gaps, AWARD_SCORING_CONFIG, true);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toEqual(expect.objectContaining({
      configPath: 'teamRankShares.standard',
      direction: 'increase',
      suggestedDelta: 0.025,
      affectedMetrics: expect.arrayContaining([
        'winner_team_rank_percentile.maxwell',
        'winner_team_rank_percentile.butkus',
      ]),
    }));
    expect(recommendations[0].evidence).toContain('Affected standard awards: maxwell, butkus');
  });

  it('couples a standard-share increase when required to preserve the Heisman premium', () => {
    const config = structuredClone(AWARD_SCORING_CONFIG);
    config.teamRankShares.standard = 0.10;
    config.teamRankShares.heisman = 0.15;
    const gap: AwardBalanceGap = {
      metric: 'winner_team_rank_percentile.maxwell',
      observed: 60,
      target: { minimum: 75 },
      severity: 0.2,
      evidence: 'fixture',
      control: 'team_rank_share',
      award: 'maxwell',
    };

    expect(buildAwardRecommendations([gap], config, true)[0])
      .toEqual(expect.objectContaining({
        configPath: 'teamRankShares.standard',
        suggestedDelta: 0.025,
        companionPath: 'teamRankShares.heisman',
        companionDelta: 0.025,
      }));
  });

  it('escalates incompatible rank-quality and team-concentration gaps', () => {
    const gaps = evaluateAwardBalance({
      'winner_team_rank_percentile.maxwell': 60,
      largest_team_award_share: 0.30,
    });
    expect(buildAwardRecommendations(gaps, AWARD_SCORING_CONFIG, true)[0])
      .toEqual(expect.objectContaining({
        configPath: null,
        direction: 'escalate',
        affectedMetrics: expect.arrayContaining([
          'winner_team_rank_percentile.maxwell',
          'largest_team_award_share',
        ]),
      }));
  });

  it('decreases standard rank bias for concentration and escalates at rank bounds', () => {
    const [concentration] = evaluateAwardBalance({ largest_team_award_share: 0.30 });
    expect(buildAwardRecommendations([concentration], AWARD_SCORING_CONFIG, true)[0])
      .toEqual(expect.objectContaining({
        configPath: 'teamRankShares.standard',
        direction: 'decrease',
        suggestedDelta: 0.025,
      }));

    const atBound = structuredClone(AWARD_SCORING_CONFIG);
    atBound.teamRankShares.heisman = 0.25;
    const [heismanGap] = evaluateAwardBalance({
      'winner_team_rank_percentile.heisman': 80,
    });
    expect(buildAwardRecommendations([heismanGap], atBound, true)[0])
      .toEqual(expect.objectContaining({
        configPath: null,
        direction: 'escalate',
      }));
  });
});
