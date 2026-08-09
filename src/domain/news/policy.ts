export const EDITORIAL_RANK_LIMIT = 25;
export const MATERIAL_RANKING_UPSET_GAP = 10;
export const MAJOR_UNDERDOG_WIN_PROBABILITY = 0.15;

export const FEATURED_PERFORMANCE_THRESHOLDS = {
  passingYards: 350,
  passingTouchdowns: 4,
  rushingYards: 175,
  rushingTouchdowns: 3,
  receivingYards: 175,
  receivingTouchdowns: 3,
  tackles: 15,
  sacks: 3,
  interceptions: 2,
  fieldGoalsMade: 4,
} as const;

export const FEATURED_PERFORMANCE_QUALIFIERS = [
  'passing_yards_350',
  'passing_touchdowns_4',
  'rushing_yards_175',
  'rushing_touchdowns_3',
  'receiving_yards_175',
  'receiving_touchdowns_3',
  'tackles_15',
  'sacks_3',
  'interceptions_2',
  'field_goals_made_4',
] as const;

export type FeaturedPerformanceQualifier =
  (typeof FEATURED_PERFORMANCE_QUALIFIERS)[number];

export type UpsetEvidence = 'odds' | 'ranking' | 'both' | null;

export interface EditorialIdentity {
  winnerEditorialRank: number | null;
  loserEditorialRank: number | null;
  upsetEvidence: UpsetEvidence;
}

export const toEditorialRank = (rank: number) =>
  rank >= 1 && rank <= EDITORIAL_RANK_LIMIT ? rank : null;

export const hasOddsUpset = (evidence: UpsetEvidence) =>
  evidence === 'odds' || evidence === 'both';

export const hasRankingUpset = (evidence: UpsetEvidence) =>
  evidence === 'ranking' || evidence === 'both';

export const hasEditorialUpset = (evidence: UpsetEvidence) => evidence !== null;

export const deriveEditorialIdentity = ({
  winnerRank,
  loserRank,
  winnerWinProbability,
}: {
  winnerRank: number;
  loserRank: number;
  winnerWinProbability: number;
}): EditorialIdentity => {
  const winnerEditorialRank = toEditorialRank(winnerRank);
  const loserEditorialRank = toEditorialRank(loserRank);
  const odds = winnerWinProbability < MAJOR_UNDERDOG_WIN_PROBABILITY;
  const ranking = loserEditorialRank !== null &&
    (winnerEditorialRank === null ||
      winnerEditorialRank - loserEditorialRank >= MATERIAL_RANKING_UPSET_GAP);
  const upsetEvidence = odds && ranking
    ? 'both'
    : odds
      ? 'odds'
      : ranking
        ? 'ranking'
        : null;
  return { winnerEditorialRank, loserEditorialRank, upsetEvidence };
};
