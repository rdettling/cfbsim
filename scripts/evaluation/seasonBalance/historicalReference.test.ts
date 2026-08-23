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
        top10AverageLosses: 1.43,
        top25AverageLosses: 2.252,
        top5TwelveGameEquivalentLosses: 0.942797,
        top10TwelveGameEquivalentLosses: 1.466573,
        top25TwelveGameEquivalentLosses: 2.33929,
      },
      modern: {
        years: [2022, 2023, 2025],
        seasons: 3,
        averageFbsGames: 11.230061,
        meanUndefeatedTeams: 2.333333,
        meanOneLossOrBetterTeams: 7,
        top5AverageLosses: 0.8,
        top10AverageLosses: 1.266667,
        top25AverageLosses: 2.253333,
        top5TwelveGameEquivalentLosses: 0.831235,
        top10TwelveGameEquivalentLosses: 1.312587,
        top25TwelveGameEquivalentLosses: 2.353007,
      },
    });
    expect(loadSeasonBalanceHistoricalReference().bySeason).toHaveLength(10);
  });
});
