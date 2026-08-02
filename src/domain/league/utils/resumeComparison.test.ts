import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import type { OddsContext } from '../../odds';
import { calculateStrengthOfScheduleRanks } from './resumeComparison';

const odds = (favWinProb: number) => ({
  favSpread: '-1',
  udSpread: '+1',
  favWinProb,
  udWinProb: 1 - favWinProb,
  favMoneyline: '-110',
  udMoneyline: '+110',
});

const oddsContext: OddsContext = {
  maxDiff: 100,
  oddsMap: {
    '0': odds(0.5),
    '4': odds(0.6),
    '20': odds(0.8),
  },
};

const game = (
  id: number,
  teamAId: number,
  teamBId: number,
  weekPlayed: number,
  homeTeamId: number | null,
  neutralSite = false,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId,
  awayTeamId: homeTeamId === teamAId ? teamBId : teamAId,
  neutralSite,
  venue: null,
  winnerId: null,
  baseLabel: 'Regular Season',
  name: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed,
  year: 2025,
  rankATOG: 0,
  rankBTOG: 0,
  resultA: null,
  resultB: null,
  overtime: 0,
  scoreA: null,
  scoreB: null,
  headline: null,
  watchability: null,
});

describe('resume strength of schedule', () => {
  it('uses only the 25 highest team ratings for the hypothetical team', () => {
    const teams = Array.from({ length: 26 }, (_, index) => buildTestTeam({
      id: index + 1,
      name: `Team ${index + 1}`,
      abbreviation: `T${index + 1}`,
      rating: index === 25 ? 0 : 80,
    }));

    const result = calculateStrengthOfScheduleRanks(teams, [], 2025, oddsContext);

    expect(result.averageTop25Rating).toBe(80);
    expect(result.ranks.get(teams[0].id)).toBeNull();
  });

  it('respects home field and neutral sites while including unplayed regular-season games', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'A', rating: 80 }),
      buildTestTeam({ id: 2, name: 'B', rating: 80 }),
      buildTestTeam({ id: 3, name: 'C', rating: 100 }),
      buildTestTeam({ id: 4, name: 'D', rating: 60 }),
    ];
    const games = [
      game(1, 1, 2, 1, 1),
      game(2, 1, 2, 2, 2),
      game(3, 1, 2, 3, null, true),
      game(4, 1, 3, 15, null, true),
    ];

    const result = calculateStrengthOfScheduleRanks(teams, games, 2025, oddsContext);

    expect(result.averageTop25Rating).toBe(80);
    expect(result.expectedWins.get(1)).toBeCloseTo(6);
    expect(result.expectedWins.get(3)).toBeNull();
  });

  it('ranks the schedule with fewer normalized expected wins as harder', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'A', rating: 80 }),
      buildTestTeam({ id: 2, name: 'B', rating: 80 }),
      buildTestTeam({ id: 3, name: 'C', rating: 100 }),
      buildTestTeam({ id: 4, name: 'D', rating: 60 }),
    ];
    const games = [
      game(1, 1, 3, 1, null, true),
      game(2, 4, 2, 1, null, true),
    ];

    const result = calculateStrengthOfScheduleRanks(teams, games, 2025, oddsContext);

    expect(result.expectedWins.get(1)).toBeCloseTo(2.4);
    expect(result.expectedWins.get(4)).toBeCloseTo(6);
    expect(result.ranks.get(1)).toBe(1);
    expect(Number(result.ranks.get(1))).toBeLessThan(Number(result.ranks.get(4)));
  });
});
