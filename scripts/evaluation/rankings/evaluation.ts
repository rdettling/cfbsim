import type { Team } from '../../../src/types/domain';
import type { GameDetailRecord, GameRecord } from '../../../src/types/db';
import { buildPerformanceIndexMap } from '../../../src/domain/league/utils/stats/teamPerformance';
import {
  comparePollOrder,
  getEvidenceScore,
  getResumeScore,
  getTeamRatingPriorWeight,
  getTeamScore,
  getWeeklyPollScore,
} from '../../../src/domain/sim/rankingScores';
import {
  runSeasonCorpus,
  type SeasonCorpusData,
} from '../shared/seasonCorpus';

export const RANKING_AUDIT_SEED = 20260823;
export const RANKING_AUDIT_SEEDS = 10;
export const RANKING_AUDIT_TOP25_LOSS_TOLERANCE = 0.5;

export interface RankingAuditArtifact {
  rankedLossMovements: number[];
  earlyTopFiveLossRanks: number[];
  rankedWinMovements: number[];
  rankedByeMovements: number[];
  lossThenWinMovements: number[];
  week14Top25AverageLosses: number[];
  structuralViolations: string[];
}

export interface RankingAuditSummary {
  metrics: {
    rankedLossAverageMovement: number;
    earlyTopFiveLossExitRate: number;
    rankedWinAverageMovement: number;
    rankedWinDropRate: number;
    rankedByeLargeDropRate: number;
    lossThenWinAverageMovement: number;
    lossThenWinContinuedDropRate: number;
    week14Top25AverageLosses: number;
  };
  expectedWeek14Top25AverageLosses: number;
  replayMatches: boolean;
  violations: string[];
  passed: boolean;
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const rate = (values: number[], predicate: (value: number) => boolean) =>
  values.filter(predicate).length / Math.max(1, values.length);

const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

const expectedScoreOrder = (
  teams: Team[],
  performanceIndexes: ReadonlyMap<number, number>,
) => [...teams].sort((left, right) => comparePollOrder({
  teamId: left.id,
  pollScore: left.poll_score,
  resumeScore: getResumeScore(left),
  performanceIndex: performanceIndexes.get(left.id)!,
}, {
  teamId: right.id,
  pollScore: right.poll_score,
  resumeScore: getResumeScore(right),
  performanceIndex: performanceIndexes.get(right.id)!,
}));

export const collectRankingAudit = (
  data: SeasonCorpusData,
  seed: number,
  seeds: number,
): RankingAuditArtifact => {
  const artifact: RankingAuditArtifact = {
    rankedLossMovements: [],
    earlyTopFiveLossRanks: [],
    rankedWinMovements: [],
    rankedByeMovements: [],
    lossThenWinMovements: [],
    week14Top25AverageLosses: [],
    structuralViolations: [],
  };
  let previousRanks = new Map<number, number>();
  let previousResults = new Map<number, 'W' | 'L'>();
  let currentResults = new Map<number, 'W' | 'L'>();
  let games: GameRecord[] = [];
  let details: GameDetailRecord[] = [];
  let previousPriorWeights = new Map<number, number>();

  runSeasonCorpus(data, { seed, seeds, seasons: 1, startYear: 2026 }, {
    onPreseason: context => {
      previousRanks = new Map(
        context.league.teams.map(team => [team.id, team.ranking]),
      );
      previousResults = new Map();
      currentResults = new Map();
      games = context.games;
      details = [];
      previousPriorWeights = new Map(
        context.league.teams.map(team => [
          team.id,
          getTeamRatingPriorWeight(team.gamesPlayed),
        ]),
      );
    },
    onGameComplete: context => {
      const game = context.game;
      details.push(context.detail);
      if (game.winnerId === null) return;
      currentResults.set(
        game.teamAId,
        game.winnerId === game.teamAId ? 'W' : 'L',
      );
      currentResults.set(
        game.teamBId,
        game.winnerId === game.teamBId ? 'W' : 'L',
      );
    },
    onRankingsUpdated: context => {
      const teams = context.league.teams;
      const week = context.league.info.currentWeek;
      const performanceIndexes = buildPerformanceIndexMap(
        teams,
        games.filter(game => game.year === context.league.info.currentYear),
        details.filter(detail => detail.year === context.league.info.currentYear),
      );
      const ordered = expectedScoreOrder(teams, performanceIndexes);
      ordered.forEach((team, index) => {
        if (team.ranking !== index + 1) {
          artifact.structuralViolations.push(
            `${context.rootSeed}: Week ${week} rank ${team.ranking} does not match Poll Score order.`,
          );
        }
        if (
          !Number.isFinite(team.poll_score) ||
          team.poll_score < 0 ||
          team.poll_score > 100
        ) {
          artifact.structuralViolations.push(
            `${context.rootSeed}: Week ${week} has an invalid Poll Score for team ${team.id}.`,
          );
        }
        const resumeScore = getResumeScore(team);
        const performanceIndex = performanceIndexes.get(team.id)!;
        const evidenceScore = getEvidenceScore({ resumeScore, performanceIndex });
        const expectedPollScore = getWeeklyPollScore({
          evidenceScore,
          teamScore: getTeamScore(team.rating),
          gamesPlayed: team.gamesPlayed,
        });
        if (Math.abs(team.poll_score - expectedPollScore) > 1e-9) {
          artifact.structuralViolations.push(
            `${context.rootSeed}: Week ${week} has an incorrect Poll Score for team ${team.id}.`,
          );
        }
        if (team.gamesPlayed >= 8 && Math.abs(team.poll_score - evidenceScore) > 1e-9) {
          artifact.structuralViolations.push(
            `${context.rootSeed}: Week ${week} retains a prior after eight games for team ${team.id}.`,
          );
        }
        const priorWeight = getTeamRatingPriorWeight(team.gamesPlayed);
        const previousPriorWeight = previousPriorWeights.get(team.id) ?? 1;
        if (priorWeight > previousPriorWeight) {
          artifact.structuralViolations.push(
            `${context.rootSeed}: Week ${week} increases the Team Rating prior for team ${team.id}.`,
          );
        }
        previousPriorWeights.set(team.id, priorWeight);
      });

      teams.forEach(team => {
        const previousRank = previousRanks.get(team.id);
        if (previousRank === undefined) {
          artifact.structuralViolations.push(
            `${context.rootSeed}: Week ${week} is missing a prior rank for team ${team.id}.`,
          );
          return;
        }
        const movement = team.ranking - previousRank;
        const result = currentResults.get(team.id);
        if (previousRank <= 25) {
          if (result === 'L') {
            artifact.rankedLossMovements.push(movement);
            if (week <= 2 && previousRank <= 5) {
              artifact.earlyTopFiveLossRanks.push(team.ranking);
            }
          }
          else if (result === 'W') artifact.rankedWinMovements.push(movement);
          else artifact.rankedByeMovements.push(movement);
          if (result === 'W' && previousResults.get(team.id) === 'L') {
            artifact.lossThenWinMovements.push(movement);
          }
        }
        previousRanks.set(team.id, team.ranking);
        if (result) previousResults.set(team.id, result);
      });

      if (week === 14) {
        artifact.week14Top25AverageLosses.push(mean(
          [...teams]
            .sort((left, right) => left.ranking - right.ranking)
            .slice(0, 25)
            .map(team => team.totalLosses),
        ));
      }
      currentResults = new Map();
    },
  });
  return artifact;
};

export const evaluateRankingAudit = ({
  artifact,
  expectedWeek14Top25AverageLosses,
  replayMatches,
}: {
  artifact: RankingAuditArtifact;
  expectedWeek14Top25AverageLosses: number;
  replayMatches: boolean;
}): RankingAuditSummary => {
  const metrics = {
    rankedLossAverageMovement: rounded(mean(artifact.rankedLossMovements)),
    earlyTopFiveLossExitRate: rounded(rate(
      artifact.earlyTopFiveLossRanks,
      rank => rank > 25,
    )),
    rankedWinAverageMovement: rounded(mean(artifact.rankedWinMovements)),
    rankedWinDropRate: rounded(rate(
      artifact.rankedWinMovements,
      value => value > 0,
    )),
    rankedByeLargeDropRate: rounded(rate(
      artifact.rankedByeMovements,
      value => value > 2,
    )),
    lossThenWinAverageMovement: rounded(mean(artifact.lossThenWinMovements)),
    lossThenWinContinuedDropRate: rounded(rate(
      artifact.lossThenWinMovements,
      value => value > 0,
    )),
    week14Top25AverageLosses: rounded(mean(artifact.week14Top25AverageLosses)),
  };
  const violations = [...artifact.structuralViolations];
  if (
    metrics.rankedLossAverageMovement < 4 ||
    metrics.rankedLossAverageMovement > 8
  ) violations.push('Ranked-team loss movement must average between 4 and 8 places.');
  if (metrics.earlyTopFiveLossExitRate > 0) {
    violations.push('An early top-five loser may not fall out of the Top 25.');
  }
  if (metrics.rankedWinDropRate > 0.15) {
    violations.push('No more than 15% of ranked winners may fall in the next poll.');
  }
  if (metrics.rankedByeLargeDropRate > 0.05) {
    violations.push('No more than 5% of ranked bye teams may fall more than two places.');
  }
  if (
    metrics.lossThenWinAverageMovement > 0 ||
    metrics.lossThenWinContinuedDropRate > 0.15
  ) violations.push('Loss-then-win teams must usually stabilize or rise.');
  if (
    Math.abs(
      metrics.week14Top25AverageLosses - expectedWeek14Top25AverageLosses,
    ) > RANKING_AUDIT_TOP25_LOSS_TOLERANCE
  ) violations.push('Week 14 Top 25 losses exceed the modern historical tolerance.');
  if (!replayMatches) violations.push('Seeded ranking replay did not match exactly.');
  return {
    metrics,
    expectedWeek14Top25AverageLosses,
    replayMatches,
    violations,
    passed: violations.length === 0,
  };
};
