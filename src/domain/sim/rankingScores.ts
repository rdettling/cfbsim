import type { Team } from '../../types/domain';

export const RANKING_RECORD_WEIGHT = 0.70;
export const RANKING_WINS_OVER_EXPECTATION_WEIGHT = 0.30;
export const EVIDENCE_RESUME_WEIGHT = 13 / 18;
export const EVIDENCE_PERFORMANCE_WEIGHT = 5 / 18;

const TEAM_RATING_PRIOR_WEIGHTS = [1, 0.9, 0.8, 0.7, 0.6, 0.45, 0.3, 0.15, 0] as const;

export const TEAM_RATING_FLOOR = 25;
export const TEAM_RATING_CEILING = 99;
const MINIMUM_RESUME_VALUE = -RANKING_WINS_OVER_EXPECTATION_WEIGHT;
const MAXIMUM_RESUME_VALUE =
  RANKING_RECORD_WEIGHT + RANKING_WINS_OVER_EXPECTATION_WEIGHT;

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

type PollOrderEntry = {
  teamId: number;
  pollScore: number;
  resumeScore: number;
  performanceIndex: number;
};

export const comparePollOrder = (
  left: PollOrderEntry,
  right: PollOrderEntry,
) => right.pollScore - left.pollScore ||
  right.resumeScore - left.resumeScore ||
  right.performanceIndex - left.performanceIndex ||
  left.teamId - right.teamId;

export const getTeamScore = (rating: number) => clampScore(
  ((rating - TEAM_RATING_FLOOR) /
    (TEAM_RATING_CEILING - TEAM_RATING_FLOOR)) * 100,
);

export const getResumeScore = (team: Team) => {
  const winningPercentage = team.gamesPlayed > 0
    ? team.totalWins / team.gamesPlayed
    : 0;
  const value = RANKING_RECORD_WEIGHT * winningPercentage +
    RANKING_WINS_OVER_EXPECTATION_WEIGHT * team.wins_over_expectation_per_game;
  return clampScore(
    ((value - MINIMUM_RESUME_VALUE) /
      (MAXIMUM_RESUME_VALUE - MINIMUM_RESUME_VALUE)) * 100,
  );
};

export const getEvidenceScore = ({
  resumeScore,
  performanceIndex,
}: {
  resumeScore: number;
  performanceIndex: number;
}) => clampScore(
  EVIDENCE_RESUME_WEIGHT * resumeScore +
  EVIDENCE_PERFORMANCE_WEIGHT * performanceIndex,
);

export const getTeamRatingPriorWeight = (gamesPlayed: number) =>
  TEAM_RATING_PRIOR_WEIGHTS[
    Math.min(
      TEAM_RATING_PRIOR_WEIGHTS.length - 1,
      Math.max(0, Math.floor(gamesPlayed)),
    )
  ];

export const getWeeklyPollScoreBreakdown = ({
  evidenceScore,
  teamScore,
  gamesPlayed,
}: {
  evidenceScore: number;
  teamScore: number;
  gamesPlayed: number;
}) => {
  const priorWeight = getTeamRatingPriorWeight(gamesPlayed);
  const evidenceWeight = 1 - priorWeight;
  const teamScoreContribution = priorWeight * teamScore;
  const evidenceScoreContribution = evidenceWeight * evidenceScore;
  return {
    priorWeight,
    evidenceWeight,
    teamScoreContribution,
    evidenceScoreContribution,
    pollScore: clampScore(
      teamScoreContribution + evidenceScoreContribution,
    ),
  };
};

export const getWeeklyPollScore = ({
  evidenceScore,
  teamScore,
  gamesPlayed,
}: {
  evidenceScore: number;
  teamScore: number;
  gamesPlayed: number;
}) => getWeeklyPollScoreBreakdown({
  evidenceScore,
  teamScore,
  gamesPlayed,
}).pollScore;
