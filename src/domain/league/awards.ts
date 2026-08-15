import type { GameLogRecord, GameRecord, PlayerRecord } from '../../types/db';
import type { LeagueState } from '../../types/league';
import type { AwardDisplayPlacement, AwardsResult } from '../../types/awards';
import type { DefenseStats, KickingStats, PassingStats, ReceivingStats, RushingStats } from '../../types/stats';
import { AWARD_DEFINITIONS, type AwardSlug } from './awardDefinitions';
import {
  AWARD_SCORING_CONFIG,
  AWARD_SCORING_POLICY,
  type AwardMetricKey,
  type AwardScoringCohort,
  type AwardScoringConfig,
} from './awardScoringConfig';
import { createAwardDisplayEntry } from './utils/awardDisplay';
import { formatAwardStatLine } from './utils/awardStatLine';
import {
  aggregatePlayerLogs,
  buildDefenseStats,
  buildKickingStats,
  buildPassingStats,
  buildReceivingStats,
  buildRushingStats,
} from './utils/stats/playerAggregates';

type CandidateProfile = {
  player: PlayerRecord;
  games: number;
  passing: PassingStats;
  rushing: RushingStats;
  receiving: ReceivingStats;
  defensive: DefenseStats;
  kicking: KickingStats;
  statLine: string;
  teamRank: number;
  teamRankPercentile: number;
};

export interface AwardComponentDiagnostic {
  key: AwardMetricKey;
  value: number;
  percentile: number;
  weight: number;
  contribution: number;
}

export interface AwardCandidateDiagnostic {
  award: AwardSlug;
  playerId: number;
  teamId: number;
  position: string;
  cohort: AwardScoringCohort;
  games: number;
  components: AwardComponentDiagnostic[];
  performanceScore: number;
  preTeamRankCoreScore: number;
  coreScore: number;
  ratingPercentile: number;
  ratingPriorShare: number;
  teamRank: number;
  teamRankPercentile: number;
  teamRankShare: number;
  finalScore: number;
  primaryProduction: number;
  primaryProductionPercentile: number;
  heismanOffensiveImpact: number | null;
  heismanOffensiveImpactPercentile: number | null;
  heismanOffensiveImpactShare: number | null;
  tiebreakers: { performanceScore: number; primaryProduction: number; playerId: number };
}

export interface AwardScoringSnapshot {
  awards: AwardsResult;
  candidates: Record<AwardSlug, AwardCandidateDiagnostic[]>;
}

type PerformanceCandidate = {
  profile: CandidateProfile;
  cohort: AwardScoringCohort;
  components: AwardComponentDiagnostic[];
  performanceScore: number;
  primaryProduction: number;
  coreScore?: number;
};

type ScoredCandidate = PerformanceCandidate & {
  score: number;
  preTeamRankCoreScore: number;
  resolvedCoreScore: number;
  ratingPercentile: number;
  ratingPriorShare: number;
  teamRankShare: number;
  primaryProductionPercentile: number;
};

type Metric = { key: AwardMetricKey; value: (candidate: CandidateProfile) => number };

const AWARD_GAME_TYPES = new Set<GameRecord['gameType']>(AWARD_SCORING_POLICY.eligibleGameTypes);
const rate = (total: number, opportunities: number) => opportunities > 0 ? total / opportunities : 0;
const gamesRate = (total: number, candidate: CandidateProfile) => rate(total, candidate.games);

export const tiedMidrankPercentiles = <T>(candidates: T[], getValue: (candidate: T) => number) => {
  const percentiles = new Map<T, number>();
  if (candidates.length === 1) {
    percentiles.set(candidates[0], 100);
    return percentiles;
  }
  const orderedValues = candidates.map(getValue).sort((left, right) => left - right);
  const ranksByValue = new Map<number, number>();
  orderedValues.forEach(value => {
    if (ranksByValue.has(value)) return;
    const first = orderedValues.indexOf(value);
    const last = orderedValues.lastIndexOf(value);
    ranksByValue.set(value, ((first + last) / 2 / (candidates.length - 1)) * 100);
  });
  candidates.forEach(candidate => percentiles.set(candidate, ranksByValue.get(getValue(candidate)) ?? 0));
  return percentiles;
};

const scorePerformance = (
  candidates: CandidateProfile[],
  cohort: AwardScoringCohort,
  metrics: Metric[],
  config: AwardScoringConfig,
  primaryProduction: (candidate: CandidateProfile) => number,
): PerformanceCandidate[] => {
  const weightedMetrics = metrics.map(metric => ({
    ...metric,
    weight: config.metricWeights[cohort][metric.key] ?? 0,
    percentiles: tiedMidrankPercentiles(candidates, metric.value),
  }));
  return candidates.map(profile => {
    const components = weightedMetrics.map(metric => {
      const value = metric.value(profile);
      const percentile = metric.percentiles.get(profile) ?? 0;
      return { key: metric.key, value, percentile, weight: metric.weight, contribution: percentile * metric.weight };
    });
    return {
      profile,
      cohort,
      components,
      performanceScore: components.reduce((sum, metric) => sum + metric.contribution, 0),
      primaryProduction: primaryProduction(profile),
    };
  });
};

const ratingPriorShare = (games: number) =>
  AWARD_SCORING_POLICY.ratingPriorByGames[Math.min(6, Math.max(0, games))] ?? 0;

const finalizeScores = (
  candidates: PerformanceCandidate[],
  teamRankShare: number,
): ScoredCandidate[] => {
  const ratingPercentiles = tiedMidrankPercentiles(candidates, candidate => candidate.profile.player.rating);
  const primaryPercentiles = tiedMidrankPercentiles(candidates, candidate => candidate.primaryProduction);
  return candidates.map(candidate => {
    const priorShare = ratingPriorShare(candidate.profile.games);
    const preTeamRankCoreScore = candidate.coreScore ?? candidate.performanceScore;
    const coreScore = preTeamRankCoreScore * (1 - teamRankShare)
      + candidate.profile.teamRankPercentile * teamRankShare;
    const ratingPercentile = ratingPercentiles.get(candidate) ?? 0;
    return {
      ...candidate,
      preTeamRankCoreScore,
      resolvedCoreScore: coreScore,
      ratingPercentile,
      ratingPriorShare: priorShare,
      teamRankShare,
      primaryProductionPercentile: primaryPercentiles.get(candidate) ?? 0,
      score: Math.max(0, Math.min(100, coreScore * (1 - priorShare) + ratingPercentile * priorShare)),
    };
  }).sort((left, right) =>
    right.score - left.score
    || right.performanceScore - left.performanceScore
    || right.primaryProduction - left.primaryProduction
    || left.profile.player.id - right.profile.player.id,
  );
};

const wilsonLowerBound = (made: number, attempted: number) => {
  if (attempted <= 0) return 0;
  const probability = made / attempted;
  const zSquared = 1;
  return (probability + zSquared / (2 * attempted)
    - Math.sqrt((probability * (1 - probability) + zSquared / (4 * attempted)) / attempted))
    / (1 + zSquared / attempted);
};

export const teamRankPercentile = (rank: number, teamCount: number) =>
  teamCount <= 1 ? 100 : ((teamCount - rank) / (teamCount - 1)) * 100;

const resolveAwardTeamRanks = (league: LeagueState) => {
  const frozen = league.resumeSnapshot?.year === league.info.currentYear
    && league.resumeSnapshot.frozenAfterWeek === 15
    ? league.resumeSnapshot.teams.map(team => ({ id: team.teamId, ranking: team.ranking }))
    : null;
  if (league.info.stage === 'summary' && !frozen) {
    throw new Error(`Final awards require post-conference-championship rankings for ${league.info.currentYear}.`);
  }
  const source = frozen ?? league.teams.map(team => ({ id: team.id, ranking: team.ranking }));
  const teamIds = new Set(league.teams.map(team => team.id));
  const ranks = new Set<number>();
  const rankings = new Map<number, number>();
  source.forEach(team => {
    if (!teamIds.has(team.id) || rankings.has(team.id)
      || !Number.isInteger(team.ranking) || team.ranking < 1
      || team.ranking > league.teams.length || ranks.has(team.ranking)) {
      throw new Error('Award team rankings must contain one unique national rank for every league team.');
    }
    rankings.set(team.id, team.ranking);
    ranks.add(team.ranking);
  });
  if (rankings.size !== league.teams.length) {
    throw new Error('Award team rankings must contain one unique national rank for every league team.');
  }
  return rankings;
};

const buildCandidateProfiles = (
  league: LeagueState,
  players: PlayerRecord[],
  games: GameRecord[],
  logs: GameLogRecord[],
) => {
  const teamRankings = resolveAwardTeamRanks(league);
  const awardGames = games.filter(game => game.year === league.info.currentYear
    && game.winnerId !== null && AWARD_GAME_TYPES.has(game.gameType));
  const awardGameIds = new Set(awardGames.map(game => game.id));
  const awardLogs = logs.filter(log => awardGameIds.has(log.gameId));
  const totalsByPlayer = aggregatePlayerLogs(awardLogs);
  const gameIdsByPlayer = new Map<number, Set<number>>();
  awardLogs.forEach(log => {
    const gameIds = gameIdsByPlayer.get(log.playerId) ?? new Set<number>();
    gameIds.add(log.gameId);
    gameIdsByPlayer.set(log.playerId, gameIds);
  });
  const teamIds = new Set(league.teams.map(team => team.id));
  return players.flatMap(player => {
    if (!teamIds.has(player.teamId)) return [];
    const totals = totalsByPlayer.get(player.id);
    const gamesPlayed = gameIdsByPlayer.get(player.id)?.size ?? 0;
    if (!totals || gamesPlayed === 0) return [];
    const teamRank = teamRankings.get(player.teamId)!;
    return [{
      player,
      games: gamesPlayed,
      passing: buildPassingStats(totals, gamesPlayed),
      rushing: buildRushingStats(totals, gamesPlayed),
      receiving: buildReceivingStats(totals, gamesPlayed),
      defensive: buildDefenseStats(totals),
      kicking: buildKickingStats(totals),
      statLine: formatAwardStatLine(totals),
      teamRank,
      teamRankPercentile: teamRankPercentile(teamRank, league.teams.length),
    }];
  });
};

const defensiveEvents = (candidate: CandidateProfile) => candidate.defensive.tackles
  + candidate.defensive.sacks + candidate.defensive.interceptions
  + candidate.defensive.fumbles_forced + candidate.defensive.fumbles_recovered;

const quarterbackMetrics: Metric[] = [
  { key: 'totalOffenseYardsPerGame', value: candidate => gamesRate(candidate.passing.yards + candidate.rushing.yards, candidate) },
  { key: 'totalTouchdownsPerGame', value: candidate => gamesRate(candidate.passing.td + candidate.rushing.td, candidate) },
  { key: 'adjustedPassYardsPerAttempt', value: candidate => candidate.passing.adjusted_pass_yards_per_attempt },
  { key: 'completionRate', value: candidate => candidate.passing.pct },
  { key: 'inverseGiveawaysPerGame', value: candidate => -gamesRate(candidate.passing.int + candidate.rushing.fumbles, candidate) },
];
const runningBackMetrics: Metric[] = [
  { key: 'scrimmageYardsPerGame', value: candidate => gamesRate(candidate.rushing.yards + candidate.receiving.yards, candidate) },
  { key: 'rushingYardsPerGame', value: candidate => candidate.rushing.yards_per_game },
  { key: 'yardsPerCarry', value: candidate => candidate.rushing.yards_per_rush },
  { key: 'totalTouchdownsPerGame', value: candidate => gamesRate(candidate.rushing.td + candidate.receiving.td, candidate) },
  { key: 'inverseFumblesPerTouch', value: candidate => -rate(candidate.rushing.fumbles, candidate.rushing.att + candidate.receiving.rec) },
];
const receiverMetrics: Metric[] = [
  { key: 'receivingYardsPerGame', value: candidate => candidate.receiving.yards_per_game },
  { key: 'receivingTouchdownsPerGame', value: candidate => gamesRate(candidate.receiving.td, candidate) },
  { key: 'catchesPerGame', value: candidate => gamesRate(candidate.receiving.rec, candidate) },
  { key: 'yardsPerCatch', value: candidate => candidate.receiving.yards_per_rec },
];
const defensiveLineMetrics: Metric[] = [
  { key: 'sacksPerGame', value: candidate => gamesRate(candidate.defensive.sacks, candidate) },
  { key: 'tacklesPerGame', value: candidate => gamesRate(candidate.defensive.tackles, candidate) },
  { key: 'forcedFumblesPerGame', value: candidate => gamesRate(candidate.defensive.fumbles_forced, candidate) },
  { key: 'recoveriesPerGame', value: candidate => gamesRate(candidate.defensive.fumbles_recovered, candidate) },
];
const linebackerMetrics: Metric[] = [
  { key: 'tacklesPerGame', value: candidate => gamesRate(candidate.defensive.tackles, candidate) },
  { key: 'sacksPerGame', value: candidate => gamesRate(candidate.defensive.sacks, candidate) },
  { key: 'interceptionsPerGame', value: candidate => gamesRate(candidate.defensive.interceptions, candidate) },
  { key: 'forcedFumblesPerGame', value: candidate => gamesRate(candidate.defensive.fumbles_forced, candidate) },
  { key: 'recoveriesPerGame', value: candidate => gamesRate(candidate.defensive.fumbles_recovered, candidate) },
];
const defensiveBackMetrics: Metric[] = [
  { key: 'interceptionsPerGame', value: candidate => gamesRate(candidate.defensive.interceptions, candidate) },
  { key: 'tacklesPerGame', value: candidate => gamesRate(candidate.defensive.tackles, candidate) },
  { key: 'forcedFumblesPerGame', value: candidate => gamesRate(candidate.defensive.fumbles_forced, candidate) },
  { key: 'recoveriesPerGame', value: candidate => gamesRate(candidate.defensive.fumbles_recovered, candidate) },
];
const kickerMetrics: Metric[] = [
  { key: 'fieldGoalsMadePerGame', value: candidate => gamesRate(candidate.kicking.field_goals_made, candidate) },
  { key: 'fieldGoalAccuracy', value: candidate => wilsonLowerBound(candidate.kicking.field_goals_made, candidate.kicking.field_goals_attempted) },
  { key: 'extraPointAccuracy', value: candidate => wilsonLowerBound(candidate.kicking.extra_points_made, candidate.kicking.extra_points_attempted) },
];

const offensiveValuePerGame = (candidate: CandidateProfile) => gamesRate(
  candidate.passing.yards / 25 + candidate.passing.td * 4 - candidate.passing.int * 5
  + (candidate.rushing.yards + candidate.receiving.yards) / 10
  + (candidate.rushing.td + candidate.receiving.td) * 6 - candidate.rushing.fumbles * 4,
  candidate,
);
const defensiveImpactPerGame = (candidate: CandidateProfile) => gamesRate(
  candidate.defensive.tackles + candidate.defensive.sacks * 4
  + candidate.defensive.interceptions * 4 + candidate.defensive.fumbles_forced * 2
  + candidate.defensive.fumbles_recovered * 2,
  candidate,
);
const nagurskiImpactPerGame = (candidate: CandidateProfile) => gamesRate(
  candidate.defensive.tackles * 0.05 + candidate.defensive.sacks
  + candidate.defensive.interceptions * 12 + candidate.defensive.fumbles_forced * 8
  + candidate.defensive.fumbles_recovered * 6,
  candidate,
);

const buildCandidatePools = (profiles: CandidateProfile[], config: AwardScoringConfig) => {
  const quarterbacks = scorePerformance(
    profiles.filter(candidate => candidate.player.pos === 'qb'
      && gamesRate(candidate.passing.att, candidate) >= config.eligibility.quarterbackPassAttemptsPerGame),
    'quarterback', quarterbackMetrics, config,
    candidate => gamesRate(candidate.passing.yards + candidate.rushing.yards, candidate),
  );
  const runningBacks = scorePerformance(
    profiles.filter(candidate => candidate.player.pos === 'rb'
      && gamesRate(candidate.rushing.att + candidate.receiving.rec, candidate) >= config.eligibility.runningBackTouchesPerGame),
    'runningBack', runningBackMetrics, config,
    candidate => gamesRate(candidate.rushing.yards + candidate.receiving.yards, candidate),
  );
  const scoreReceivers = (positions: Set<string>) => scorePerformance(
    profiles.filter(candidate => positions.has(candidate.player.pos)
      && gamesRate(candidate.receiving.rec, candidate) >= config.eligibility.receiverCatchesPerGame),
    'receiver', receiverMetrics, config, candidate => candidate.receiving.yards_per_game,
  );
  const scoreDefenders = (
    positions: Set<string>, cohort: AwardScoringCohort, metrics: Metric[],
    primary: (candidate: CandidateProfile) => number,
  ) => scorePerformance(
    profiles.filter(candidate => positions.has(candidate.player.pos)
      && gamesRate(defensiveEvents(candidate), candidate) >= config.eligibility.defenderEventsPerGame),
    cohort, metrics, config, primary,
  );
  const heismanReceivers = scoreReceivers(new Set(['wr', 'te']));
  const wideReceivers = scoreReceivers(new Set(['wr']));
  const tightEnds = scoreReceivers(new Set(['te']));
  const defensiveLine = scoreDefenders(new Set(['dl']), 'defensiveLine', defensiveLineMetrics, candidate => gamesRate(candidate.defensive.sacks, candidate));
  const linebackers = scoreDefenders(new Set(['lb']), 'linebacker', linebackerMetrics, candidate => gamesRate(candidate.defensive.tackles, candidate));
  const defensiveBacks = scoreDefenders(new Set(['cb', 's']), 'defensiveBack', defensiveBackMetrics, candidate => gamesRate(candidate.defensive.interceptions, candidate));
  const kickers = scorePerformance(
    profiles.filter(candidate => candidate.player.pos === 'k'
      && candidate.kicking.field_goals_attempted >= Math.ceil(candidate.games * config.eligibility.kickerFieldGoalAttemptsPerGame)),
    'kicker', kickerMetrics, config, candidate => gamesRate(candidate.kicking.field_goals_made, candidate),
  );
  const offensiveCandidates = [...quarterbacks, ...runningBacks, ...heismanReceivers].map(
    candidate => ({
      ...candidate,
      primaryProduction: offensiveValuePerGame(candidate.profile),
    }),
  );
  const offensiveImpactPercentiles = tiedMidrankPercentiles(
    offensiveCandidates,
    candidate => candidate.primaryProduction,
  );
  const heismanImpactShare = config.heismanOffensiveImpactShare;
  const heisman = offensiveCandidates.map(candidate => ({
    ...candidate,
    coreScore: candidate.performanceScore * (1 - heismanImpactShare)
      + (offensiveImpactPercentiles.get(candidate) ?? 0) * heismanImpactShare,
  }));
  const bednarik = [...defensiveLine, ...linebackers, ...defensiveBacks].map(candidate => ({
    ...candidate,
    primaryProduction: defensiveImpactPerGame(candidate.profile),
  }));
  const nagurskiCandidates = bednarik.map(candidate => ({
    ...candidate,
    primaryProduction: nagurskiImpactPerGame(candidate.profile),
  }));
  const defensiveImpactPercentiles = tiedMidrankPercentiles(
    nagurskiCandidates,
    candidate => candidate.primaryProduction,
  );
  const impactShare = config.nagurskiDefensiveImpactShare;
  const nagurski = nagurskiCandidates.map(candidate => ({
    ...candidate,
    coreScore: candidate.performanceScore * (1 - impactShare)
      + (defensiveImpactPercentiles.get(candidate) ?? 0) * impactShare,
  }));
  return {
    heisman: finalizeScores(heisman, config.teamRankShares.heisman),
    maxwell: finalizeScores(offensiveCandidates, config.teamRankShares.standard),
    davey_obrien: finalizeScores(quarterbacks, config.teamRankShares.standard),
    doak_walker: finalizeScores(runningBacks, config.teamRankShares.standard),
    biletnikoff: finalizeScores(wideReceivers, config.teamRankShares.standard),
    mackey: finalizeScores(tightEnds, config.teamRankShares.standard),
    bednarik: finalizeScores(bednarik, config.teamRankShares.standard),
    nagurski: finalizeScores(nagurski, config.teamRankShares.standard),
    ted_hendricks: finalizeScores(defensiveLine, config.teamRankShares.standard),
    butkus: finalizeScores(linebackers, config.teamRankShares.standard),
    thorpe: finalizeScores(defensiveBacks, config.teamRankShares.standard),
    lou_groza: finalizeScores(kickers, config.teamRankShares.standard),
  } satisfies Record<AwardSlug, ScoredCandidate[]>;
};

export const buildAwardScoringSnapshot = (
  league: LeagueState,
  players: PlayerRecord[],
  games: GameRecord[],
  logs: GameLogRecord[],
  config: AwardScoringConfig = AWARD_SCORING_CONFIG,
): AwardScoringSnapshot => {
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const candidatesBySlug = buildCandidatePools(buildCandidateProfiles(league, players, games, logs), config);
  const buildDisplayEntry = (slug: AwardSlug) => {
    const keys = ['first', 'second', 'third'] as const;
    const placements: AwardDisplayPlacement[] = keys.map((key, index) => {
      const candidate = candidatesBySlug[slug][index];
      if (!candidate) return { key, player: null, score: null, statLine: null };
      const { player } = candidate.profile;
      return {
        key,
        player: {
          id: player.id,
          first: player.first,
          last: player.last,
          position: player.pos,
          teamName: teamsById.get(player.teamId)?.name ?? '',
        },
        score: candidate.score,
        statLine: candidate.profile.statLine,
      };
    });
    return createAwardDisplayEntry(slug, placements);
  };
  const displayed = AWARD_DEFINITIONS.map(definition => buildDisplayEntry(definition.slug));
  const candidates = Object.fromEntries(AWARD_DEFINITIONS.map(definition => [
    definition.slug,
    candidatesBySlug[definition.slug].map(candidate => ({
      award: definition.slug,
      playerId: candidate.profile.player.id,
      teamId: candidate.profile.player.teamId,
      position: candidate.profile.player.pos,
      cohort: candidate.cohort,
      games: candidate.profile.games,
      components: candidate.components,
      performanceScore: candidate.performanceScore,
      preTeamRankCoreScore: candidate.preTeamRankCoreScore,
      coreScore: candidate.resolvedCoreScore,
      ratingPercentile: candidate.ratingPercentile,
      ratingPriorShare: candidate.ratingPriorShare,
      teamRank: candidate.profile.teamRank,
      teamRankPercentile: candidate.profile.teamRankPercentile,
      teamRankShare: candidate.teamRankShare,
      finalScore: candidate.score,
      primaryProduction: candidate.primaryProduction,
      primaryProductionPercentile: candidate.primaryProductionPercentile,
      heismanOffensiveImpact: definition.slug === 'heisman'
        ? candidate.primaryProduction : null,
      heismanOffensiveImpactPercentile: definition.slug === 'heisman'
        ? candidate.primaryProductionPercentile : null,
      heismanOffensiveImpactShare: definition.slug === 'heisman'
        ? config.heismanOffensiveImpactShare : null,
      tiebreakers: {
        performanceScore: candidate.performanceScore,
        primaryProduction: candidate.primaryProduction,
        playerId: candidate.profile.player.id,
      },
    })),
  ])) as Record<AwardSlug, AwardCandidateDiagnostic[]>;
  return {
    awards: {
      live: displayed,
      final: displayed.map(entry => ({ ...entry, placements: [...entry.placements] })),
    },
    candidates,
  };
};

export const buildAwards = (
  league: LeagueState,
  players: PlayerRecord[],
  games: GameRecord[],
  logs: GameLogRecord[],
): AwardsResult => buildAwardScoringSnapshot(league, players, games, logs).awards;
