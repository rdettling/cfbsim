import { describe, expect, it } from 'vitest';
import {
  deriveEditorialIdentity,
  EDITORIAL_RANK_LIMIT,
  FEATURED_PERFORMANCE_QUALIFIERS,
  FEATURED_PERFORMANCE_THRESHOLDS,
  hasEditorialUpset,
  hasOddsUpset,
  hasRankingUpset,
  MAJOR_UNDERDOG_WIN_PROBABILITY,
  MATERIAL_RANKING_UPSET_GAP,
  toEditorialRank,
} from './policy';

describe('league news editorial policy', () => {
  it('owns the complete exceptional-performance policy', () => {
    expect(FEATURED_PERFORMANCE_THRESHOLDS).toEqual({
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
    });
    expect(new Set(FEATURED_PERFORMANCE_QUALIFIERS).size)
      .toBe(FEATURED_PERFORMANCE_QUALIFIERS.length);
  });

  it('enforces top-25 identity at the exact boundary', () => {
    expect(EDITORIAL_RANK_LIMIT).toBe(25);
    expect(toEditorialRank(1)).toBe(1);
    expect(toEditorialRank(25)).toBe(25);
    expect(toEditorialRank(26)).toBeNull();
    expect(toEditorialRank(0)).toBeNull();
  });

  it('derives odds, ranking, combined, and null upset evidence', () => {
    expect(MAJOR_UNDERDOG_WIN_PROBABILITY).toBe(0.15);
    expect(MATERIAL_RANKING_UPSET_GAP).toBe(10);
    expect(deriveEditorialIdentity({ winnerRank: 26, loserRank: 27, winnerWinProbability: 0.149 }).upsetEvidence)
      .toBe('odds');
    expect(deriveEditorialIdentity({ winnerRank: 26, loserRank: 12, winnerWinProbability: 0.65 }).upsetEvidence)
      .toBe('ranking');
    expect(deriveEditorialIdentity({ winnerRank: 25, loserRank: 5, winnerWinProbability: 0.1 }).upsetEvidence)
      .toBe('both');
    expect(deriveEditorialIdentity({ winnerRank: 24, loserRank: 15, winnerWinProbability: 0.15 }).upsetEvidence)
      .toBeNull();
  });

  it('provides exhaustive evidence predicates', () => {
    expect(['odds', 'ranking', 'both', null].map(evidence => ({
      editorial: hasEditorialUpset(evidence as 'odds' | 'ranking' | 'both' | null),
      odds: hasOddsUpset(evidence as 'odds' | 'ranking' | 'both' | null),
      ranking: hasRankingUpset(evidence as 'odds' | 'ranking' | 'both' | null),
    }))).toEqual([
      { editorial: true, odds: true, ranking: false },
      { editorial: true, odds: false, ranking: true },
      { editorial: true, odds: true, ranking: true },
      { editorial: false, odds: false, ranking: false },
    ]);
  });
});
