import type { GameDetailRecord, GameRecord } from '../../../src/types/db';
import { buildPerformanceIndexMap } from '../../../src/domain/league/utils/stats/teamPerformance';
import {
  runSeasonCorpus,
  type SeasonCorpusData,
} from '../shared/seasonCorpus';

export const PERFORMANCE_INDEX_AUDIT_SEED = 20260824;
export const PERFORMANCE_INDEX_AUDIT_SEEDS = 10;

export interface PerformanceIndexAuditSummary {
  games: number;
  secondHalfGames: number;
  adjustedWinnerAccuracy: number;
  rawWinnerAccuracy: number;
  secondHalfAdjustedWinnerAccuracy: number;
  secondHalfRawWinnerAccuracy: number;
  finiteScores: boolean;
  replayMatches: boolean;
  violations: string[];
  passed: boolean;
}

type PredictionCounts = {
  games: number;
  adjustedCorrect: number;
  rawCorrect: number;
  secondHalfGames: number;
  secondHalfAdjustedCorrect: number;
  secondHalfRawCorrect: number;
  finiteScores: boolean;
};

const rounded = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export const collectPerformanceIndexAudit = (
  data: SeasonCorpusData,
  seed: number,
  seeds: number,
) => {
  const counts: PredictionCounts = {
    games: 0,
    adjustedCorrect: 0,
    rawCorrect: 0,
    secondHalfGames: 0,
    secondHalfAdjustedCorrect: 0,
    secondHalfRawCorrect: 0,
    finiteScores: true,
  };
  let details: GameDetailRecord[] = [];
  let completedGames: GameRecord[] = [];
  let adjustedByTeamId = new Map<number, number>();
  let rawByTeamId = new Map<number, number>();

  runSeasonCorpus(data, { seed, seeds, seasons: 1, startYear: 2026 }, {
    onPreseason: context => {
      details = [];
      completedGames = [];
      adjustedByTeamId = new Map(context.league.teams.map(team => [team.id, 50]));
      rawByTeamId = new Map(context.league.teams.map(team => [team.id, 50]));
    },
    onGameComplete: context => {
      const game = context.game;
      if (game.gameType === 'regular_season' && game.winnerId !== null) {
        const adjustedA = adjustedByTeamId.get(game.teamAId) ?? 50;
        const adjustedB = adjustedByTeamId.get(game.teamBId) ?? 50;
        const rawA = rawByTeamId.get(game.teamAId) ?? 50;
        const rawB = rawByTeamId.get(game.teamBId) ?? 50;
        if (adjustedA !== adjustedB && rawA !== rawB) {
          counts.games += 1;
          const adjustedPick = adjustedA > adjustedB ? game.teamAId : game.teamBId;
          const rawPick = rawA > rawB ? game.teamAId : game.teamBId;
          if (adjustedPick === game.winnerId) counts.adjustedCorrect += 1;
          if (rawPick === game.winnerId) counts.rawCorrect += 1;
          if (game.weekPlayed >= 8) {
            counts.secondHalfGames += 1;
            if (adjustedPick === game.winnerId) counts.secondHalfAdjustedCorrect += 1;
            if (rawPick === game.winnerId) counts.secondHalfRawCorrect += 1;
          }
        }
      }
      completedGames.push(game);
      details.push(context.detail);
    },
    onRankingsUpdated: context => {
      adjustedByTeamId = buildPerformanceIndexMap(
        context.league.teams,
        completedGames,
        details,
      );
      rawByTeamId = buildPerformanceIndexMap(
        context.league.teams,
        completedGames,
        details,
        0,
      );
      counts.finiteScores &&= [...adjustedByTeamId.values()].every(score =>
        Number.isFinite(score) && score >= 0 && score <= 100
      );
    },
  });
  return counts;
};

export const evaluatePerformanceIndexAudit = (
  counts: PredictionCounts,
  replayMatches: boolean,
): PerformanceIndexAuditSummary => {
  const accuracy = (correct: number, games: number) =>
    games ? correct / games : 0;
  const summary = {
    games: counts.games,
    secondHalfGames: counts.secondHalfGames,
    adjustedWinnerAccuracy: rounded(accuracy(counts.adjustedCorrect, counts.games)),
    rawWinnerAccuracy: rounded(accuracy(counts.rawCorrect, counts.games)),
    secondHalfAdjustedWinnerAccuracy: rounded(accuracy(
      counts.secondHalfAdjustedCorrect,
      counts.secondHalfGames,
    )),
    secondHalfRawWinnerAccuracy: rounded(accuracy(
      counts.secondHalfRawCorrect,
      counts.secondHalfGames,
    )),
    finiteScores: counts.finiteScores,
  };
  const violations: string[] = [];
  if (summary.games === 0 || summary.secondHalfGames === 0) {
    violations.push('The Performance Index audit must include held-out games.');
  }
  if (
    summary.secondHalfAdjustedWinnerAccuracy <
    summary.secondHalfRawWinnerAccuracy - 0.01
  ) {
    violations.push(
      'Opponent adjustment may not trail raw second-half performance accuracy by more than one percentage point.',
    );
  }
  if (!summary.finiteScores) violations.push('Performance Index scores must be finite and within 0–100.');
  if (!replayMatches) violations.push('Seeded Performance Index replay did not match exactly.');
  return {
    ...summary,
    replayMatches,
    violations,
    passed: violations.length === 0,
  };
};
