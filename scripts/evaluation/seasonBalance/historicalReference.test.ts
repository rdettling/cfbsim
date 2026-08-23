import { describe, expect, it } from 'vitest';
import { loadSeasonBalanceHistoricalReference } from './historicalReference';

describe('season-balance historical reference', () => {
  it('derives broad and modern bundled FBS-only context', () => {
    expect(loadSeasonBalanceHistoricalReference()).toMatchObject({
      methodology: {
        minimumFbsGames: 8,
        simulatedFbsGames: 12,
      },
      all: {
        seasons: 10,
        meanUndefeatedTeams: 2,
        meanOneLossOrBetterTeams: 6.6,
        top5AverageLosses: 0.94,
        top10AverageLosses: 1.48,
        top25AverageLosses: 2.272,
        top5TwelveGameEquivalentLosses: 0.942797,
        top10TwelveGameEquivalentLosses: 1.521119,
        top25TwelveGameEquivalentLosses: 2.361108,
      },
      modern: {
        years: [2022, 2023, 2025],
        seasons: 3,
        averageFbsGames: 11.230061,
        meanUndefeatedTeams: 2.333333,
        meanOneLossOrBetterTeams: 7,
        top5AverageLosses: 0.8,
        top10AverageLosses: 1.433333,
        top25AverageLosses: 2.32,
        top5TwelveGameEquivalentLosses: 0.831235,
        top10TwelveGameEquivalentLosses: 1.494406,
        top25TwelveGameEquivalentLosses: 2.425734,
      },
    });
    expect(loadSeasonBalanceHistoricalReference().bySeason).toHaveLength(10);
  });
});
