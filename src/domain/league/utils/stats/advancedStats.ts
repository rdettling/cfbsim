import type { GameDetailRecord, GameRecord } from '../../../../types/db';
import type { Team } from '../../../../types/domain';
import type {
  AdvancedTeamStatsRow,
  PollRankOverrideReason,
} from '../../../../types/stats';
import {
  comparePollOrder,
  getEvidenceScore,
  getResumeScore,
  getTeamScore,
  getWeeklyPollScoreBreakdown,
} from '../../../sim/rankingScores';
import { buildTeamPerformance } from './teamPerformance';

export const buildAdvancedTeamStats = (
  teams: Team[],
  games: GameRecord[],
  details: GameDetailRecord[],
  overrideContext: PollRankOverrideReason = null,
): AdvancedTeamStatsRow[] => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const rows = buildTeamPerformance(teams, games, details).map(performance => {
    const team = teamsById.get(performance.teamId)!;
    const resumeScore = getResumeScore(team);
    const evidenceScore = getEvidenceScore({
      resumeScore,
      performanceIndex: performance.performanceIndex,
    });
    const teamScore = getTeamScore(team.rating);
    const pollBreakdown = getWeeklyPollScoreBreakdown({
      evidenceScore,
      teamScore,
      gamesPlayed: performance.games,
    });
    const row: AdvancedTeamStatsRow = {
      ...performance,
      teamName: team.name,
      record: team.record,
      pollRank: team.ranking,
      pollScore: team.poll_score,
      projectedPollScore: pollBreakdown.pollScore,
      pollScoreMatchesProjection:
        Math.abs(team.poll_score - pollBreakdown.pollScore) <= 1e-9,
      pollRankOverrideReason: null,
      teamRating: team.rating,
      teamScore,
      teamRatingPriorWeight: pollBreakdown.priorWeight,
      teamScoreContribution: pollBreakdown.teamScoreContribution,
      evidenceScoreContribution: pollBreakdown.evidenceScoreContribution,
      resumeScore,
      evidenceScore,
    };
    return row;
  });
  if (overrideContext) {
    const scoreOrder = new Map([...rows]
      .sort(comparePollOrder)
      .map((row, index) => [row.teamId, index + 1]));
    rows.forEach(row => {
      if (row.pollRank !== scoreOrder.get(row.teamId)) {
        row.pollRankOverrideReason = overrideContext;
      }
    });
  }
  return rows;
};
