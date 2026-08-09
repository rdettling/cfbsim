import type { GameStoryFacts } from './facts';
import { hasOddsUpset, hasRankingUpset } from './policy';

export const NEWSWORTHINESS_DIMENSIONS = [
  'consequence',
  'national_relevance',
  'drama',
] as const;

export type NewsworthinessDimension =
  (typeof NEWSWORTHINESS_DIMENSIONS)[number];

export const NEWSWORTHINESS_COMPONENTS = {
  'base:regular_season': { dimension: 'consequence', points: 10 },
  'base:bowl': { dimension: 'consequence', points: 45 },
  'base:conference_championship': { dimension: 'consequence', points: 70 },
  'base:playoff_first_round': { dimension: 'consequence', points: 75 },
  'base:playoff_quarterfinal': { dimension: 'consequence', points: 80 },
  'base:playoff_semifinal': { dimension: 'consequence', points: 85 },
  'base:national_championship': { dimension: 'consequence', points: 100 },
  'base:weekly_rankings': { dimension: 'consequence', points: 12 },
  'base:playoff_selection': { dimension: 'consequence', points: 80 },
  'base:preseason_poll': { dimension: 'consequence', points: 18 },
  'base:national_outlook': { dimension: 'consequence', points: 16 },
  'base:marquee_opener': { dimension: 'consequence', points: 14 },
  'rank_participation:1_5': { dimension: 'national_relevance', points: 12 },
  'rank_participation:6_10': { dimension: 'national_relevance', points: 9 },
  'rank_participation:11_15': { dimension: 'national_relevance', points: 6 },
  'rank_participation:16_25': { dimension: 'national_relevance', points: 3 },
  both_ranked: { dimension: 'national_relevance', points: 4 },
  rivalry: { dimension: 'national_relevance', points: 8 },
  featured_player: { dimension: 'national_relevance', points: 5 },
  major_underdog_win: { dimension: 'drama', points: 25 },
  ranking_upset: { dimension: 'drama', points: 20 },
  overtime: { dimension: 'drama', points: 12 },
  late_lead_change: { dimension: 'drama', points: 12 },
  comeback_14_plus: { dimension: 'drama', points: 12 },
  comeback_7_to_13: { dimension: 'drama', points: 6 },
  shutout: { dimension: 'drama', points: 5 },
  margin_28_plus: { dimension: 'drama', points: 4 },
  new_number_one: { dimension: 'drama', points: 15 },
  top_five_shakeup: { dimension: 'drama', points: 10 },
  top_25_turnover: { dimension: 'drama', points: 8 },
} as const satisfies Record<string, {
  dimension: NewsworthinessDimension;
  points: number;
}>;

export type NewsworthinessComponentId = keyof typeof NEWSWORTHINESS_COMPONENTS;

export interface NewsworthinessComponent {
  id: NewsworthinessComponentId;
  dimension: NewsworthinessDimension;
  points: number;
}

export type NewsworthinessDimensionTotals = Record<NewsworthinessDimension, number>;

export interface NewsworthinessBreakdown {
  total: number;
  dimensions: NewsworthinessDimensionTotals;
  components: NewsworthinessComponent[];
}

export const buildNewsworthiness = (
  componentIds: readonly NewsworthinessComponentId[],
): NewsworthinessBreakdown => {
  if (new Set(componentIds).size !== componentIds.length) {
    throw new Error('Newsworthiness components must be unique.');
  }
  const dimensions: NewsworthinessDimensionTotals = {
    consequence: 0,
    national_relevance: 0,
    drama: 0,
  };
  const components = componentIds.map(id => {
    const definition = NEWSWORTHINESS_COMPONENTS[id];
    dimensions[definition.dimension] += definition.points;
    return { id, ...definition };
  });
  return {
    total: components.reduce((sum, component) => sum + component.points, 0),
    dimensions,
    components,
  };
};

export const bestEditorialRank = (
  winnerRank: number | null,
  loserRank: number | null,
) => {
  const ranks = [winnerRank, loserRank].filter(
    (rank): rank is number => rank !== null && rank >= 1 && rank <= 25,
  );
  return ranks.length ? Math.min(...ranks) : null;
};

export const rankedParticipationComponent = (
  winnerRank: number | null,
  loserRank: number | null,
): NewsworthinessComponentId | null => {
  const rank = bestEditorialRank(winnerRank, loserRank);
  if (rank === null) return null;
  if (rank <= 5) return 'rank_participation:1_5';
  if (rank <= 10) return 'rank_participation:6_10';
  if (rank <= 15) return 'rank_participation:11_15';
  return 'rank_participation:16_25';
};

export const scoreGameNewsworthiness = (
  facts: GameStoryFacts,
): NewsworthinessBreakdown => {
  const ids: NewsworthinessComponentId[] = [`base:${facts.game.gameType}`];
  const rankedParticipation = rankedParticipationComponent(
    facts.winnerEditorialRank,
    facts.loserEditorialRank,
  );
  if (rankedParticipation) ids.push(rankedParticipation);
  if (facts.winnerEditorialRank !== null && facts.loserEditorialRank !== null) {
    ids.push('both_ranked');
  }
  if (facts.game.rivalryKey) ids.push('rivalry');
  if (facts.featuredPerformance) ids.push('featured_player');
  if (hasOddsUpset(facts.upsetEvidence)) ids.push('major_underdog_win');
  if (hasRankingUpset(facts.upsetEvidence)) ids.push('ranking_upset');
  if (facts.game.overtime > 0) ids.push('overtime');
  if (facts.lateWinningScore) ids.push('late_lead_change');
  if (facts.largestWinnerDeficit >= 14) ids.push('comeback_14_plus');
  else if (facts.largestWinnerDeficit >= 7) ids.push('comeback_7_to_13');
  if (facts.shutout) ids.push('shutout');
  if (facts.margin >= 28) ids.push('margin_28_plus');
  return buildNewsworthiness(ids);
};

export const scoreRankingNewsworthiness = ({
  playoffField,
  featuredRanks,
  newNumberOne,
  topFiveShakeup,
  top25Turnover,
}: {
  playoffField: boolean;
  featuredRanks: readonly number[];
  newNumberOne: boolean;
  topFiveShakeup: boolean;
  top25Turnover: boolean;
}): NewsworthinessBreakdown => {
  const ids: NewsworthinessComponentId[] = [
    playoffField ? 'base:playoff_selection' : 'base:weekly_rankings',
  ];
  const bestRank = featuredRanks.length ? Math.min(...featuredRanks) : null;
  const participation = rankedParticipationComponent(bestRank, null);
  if (participation) ids.push(participation);
  if (newNumberOne) ids.push('new_number_one');
  if (topFiveShakeup) ids.push('top_five_shakeup');
  if (top25Turnover) ids.push('top_25_turnover');
  return buildNewsworthiness(ids);
};

export const scorePreviewNewsworthiness = ({
  angle,
  featuredRanks,
  bothRanked = false,
  rivalry = false,
}: {
  angle: 'preseason_poll' | 'national_outlook' | 'marquee_opener';
  featuredRanks: readonly number[];
  bothRanked?: boolean;
  rivalry?: boolean;
}) => {
  const ids: NewsworthinessComponentId[] = [`base:${angle}`];
  const bestRank = featuredRanks.length ? Math.min(...featuredRanks) : null;
  const participation = rankedParticipationComponent(bestRank, null);
  if (participation) ids.push(participation);
  if (bothRanked) ids.push('both_ranked');
  if (rivalry) ids.push('rivalry');
  return buildNewsworthiness(ids);
};
