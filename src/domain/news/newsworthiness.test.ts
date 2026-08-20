import { describe, expect, it } from 'vitest';
import type { GameStoryFacts } from './facts';
import {
  buildNewsworthiness,
  NEWSWORTHINESS_COMPONENTS,
  rankedParticipationComponent,
  scoreGameNewsworthiness,
} from './newsworthiness';
import { sortNewsItems } from './ordering';

const facts = (overrides: Partial<GameStoryFacts> = {}): GameStoryFacts => ({
  game: {
    id: 1,
    teamAId: 1,
    teamBId: 2,
    homeTeamId: 1,
    awayTeamId: 2,
    neutralSite: false,
    venue: null,
    winnerId: 1,
    baseLabel: 'Winner vs Loser',
    name: null,
    gameType: 'regular_season',
    rivalryKey: null,
    spreadA: '-3',
    spreadB: '+3',
    moneylineA: '-150',
    moneylineB: '+130',
    winProbA: 0.6,
    winProbB: 0.4,
    weekPlayed: 1,
    year: 2026,
    rankATOG: 0,
    rankBTOG: 0,
    resultA: 'W',
    resultB: 'L',
    overtime: 0,
    quarter: 4,
    clockSecondsLeft: 0,
    scoreA: 24,
    scoreB: 17,
    watchability: 50,
  },
  winner: { id: 1, name: 'Winner' } as GameStoryFacts['winner'],
  loser: { id: 2, name: 'Loser' } as GameStoryFacts['loser'],
  winnerScore: 24,
  loserScore: 17,
  margin: 7,
  winnerRank: 0,
  loserRank: 0,
  winnerEditorialRank: null,
  loserEditorialRank: null,
  winnerWinProbability: 0.6,
  upsetEvidence: null,
  scoringEvents: [],
  leadChanges: 0,
  largestWinnerDeficit: 0,
  fourthQuarterComeback: false,
  lateWinningScore: null,
  turnoversForcedByWinner: 0,
  turnoversCommittedByWinner: 0,
  shutout: false,
  defensiveDominance: false,
  featuredPerformance: null,
  priorMeetings: 0,
  winnerSeriesStreak: 1,
  revenge: false,
  postseasonRematch: false,
  ...overrides,
});

describe('league newsworthiness policy', () => {
  it.each([
    [1, 'rank_participation:1_5'],
    [5, 'rank_participation:1_5'],
    [6, 'rank_participation:6_10'],
    [10, 'rank_participation:6_10'],
    [11, 'rank_participation:11_15'],
    [15, 'rank_participation:11_15'],
    [16, 'rank_participation:16_25'],
    [25, 'rank_participation:16_25'],
  ] as const)('assigns rank %i to %s', (rank, component) => {
    expect(rankedParticipationComponent(rank, null)).toBe(component);
    expect(rankedParticipationComponent(null, rank)).toBe(component);
  });

  it('treats rank 26 and missing ranks as unranked', () => {
    expect(rankedParticipationComponent(null, null)).toBeNull();
    expect(rankedParticipationComponent(26, null)).toBeNull();
  });

  it('uses the best participant rank and rewards a two-ranked-team matchup once', () => {
    const score = scoreGameNewsworthiness(facts({
      winnerEditorialRank: 18,
      loserEditorialRank: 4,
    }));
    expect(score).toMatchObject({
      total: 26,
      dimensions: { consequence: 10, national_relevance: 16, drama: 0 },
      components: expect.arrayContaining([
        expect.objectContaining({ id: 'rank_participation:1_5', points: 12 }),
        expect.objectContaining({ id: 'both_ranked', points: 4 }),
      ]),
    });
  });

  it('places every fixed component in its declared dimension', () => {
    const ids = Object.keys(NEWSWORTHINESS_COMPONENTS) as Array<keyof typeof NEWSWORTHINESS_COMPONENTS>;
    for (const id of ids) {
      const result = buildNewsworthiness([id]);
      const definition = NEWSWORTHINESS_COMPONENTS[id];
      expect(result.total, id).toBe(definition.points);
      expect(result.dimensions[definition.dimension], id).toBe(definition.points);
      expect(result.components[0], id).toEqual({ id, ...definition });
    }
  });

  it('rejects duplicate components', () => {
    expect(() => buildNewsworthiness(['rivalry', 'rivalry'])).toThrow('unique');
  });

  it('keeps ranked participation separate from upset drama', () => {
    const score = scoreGameNewsworthiness(facts({
      winnerEditorialRank: null,
      loserEditorialRank: 3,
      winnerWinProbability: 0.1,
      upsetEvidence: 'both',
    }));
    expect(score.dimensions).toEqual({ consequence: 10, national_relevance: 12, drama: 45 });
    expect(score.total).toBe(67);
  });

  it('produces the selected moderate national ordering without excluding unranked drama', () => {
    const topFiveRoutine = scoreGameNewsworthiness(facts({ winnerEditorialRank: 3 })).total;
    const topTenRoutine = scoreGameNewsworthiness(facts({ winnerEditorialRank: 8 })).total;
    const unrankedRivalry = scoreGameNewsworthiness(facts({
      game: { ...facts().game, rivalryKey: 'rivalry' },
    })).total;
    const unrankedUnderdog = scoreGameNewsworthiness(facts({
      winnerWinProbability: 0.1,
      upsetEvidence: 'odds',
    })).total;
    const postseason = scoreGameNewsworthiness(facts({
      game: { ...facts().game, gameType: 'conference_championship' },
    })).total;
    expect(topFiveRoutine).toBe(22);
    expect(topTenRoutine).toBe(19);
    expect(unrankedRivalry).toBe(18);
    expect(unrankedUnderdog).toBe(35);
    expect(postseason).toBe(70);
    expect(sortNewsItems([
      { id: 'game:1', type: 'game' as const, importance: topFiveRoutine, gameId: 1, label: 'ranked' },
      { id: 'game:2', type: 'game' as const, importance: unrankedRivalry, gameId: 2, label: 'rivalry' },
      { id: 'game:3', type: 'game' as const, importance: unrankedUnderdog, gameId: 3, label: 'underdog' },
    ]).map(item => item.label)).toEqual(['underdog', 'ranked', 'rivalry']);
  });

  it('does not use program prestige as a scoring input', () => {
    const lowPrestige = facts({
      winner: { ...facts().winner, prestige: 1 },
      winnerEditorialRank: 8,
    });
    const highPrestige = facts({
      winner: { ...facts().winner, prestige: 7 },
      winnerEditorialRank: 8,
    });
    expect(scoreGameNewsworthiness(lowPrestige)).toEqual(scoreGameNewsworthiness(highPrestige));
  });

  it('places game results before rankings releases at equal importance', () => {
    expect(sortNewsItems([
      { id: 'rankings:2026:4', type: 'rankings' as const, importance: 30 },
      { id: 'game:8', type: 'game' as const, gameId: 8, importance: 30 },
      { id: 'game:9', type: 'game' as const, gameId: 9, importance: 30 },
    ]).map(item => item.id)).toEqual(['game:9', 'game:8', 'rankings:2026:4']);
  });
});
