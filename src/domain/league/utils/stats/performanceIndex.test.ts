import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../../../../types/db';
import type { AdvancedUnitStats } from '../../../../types/stats';
import {
  buildPerformanceIndexes,
  type PerformanceIndexInput,
} from './performanceIndex';

const unit = (overrides: Partial<AdvancedUnitStats> = {}): AdvancedUnitStats => ({
  successRate: 0.45,
  standardDownSuccessRate: 0.45,
  passingDownSuccessRate: 0.45,
  explosivePlayRate: 0.12,
  successfulPlayYards: 10,
  pointsPerOpportunity: 4.5,
  havocRate: 0.1,
  averageStartingFieldPosition: 30,
  lineYardsPerCarry: 3.5,
  stuffRate: 0.18,
  ...overrides,
});

const input = (
  teamId: number,
  overrides: Partial<PerformanceIndexInput> = {},
): PerformanceIndexInput => ({
  teamId,
  games: 1,
  offenseOpportunities: 3,
  defenseOpportunities: 3,
  offense: unit(),
  defense: unit(),
  ...overrides,
});

const game = (id: number, teamAId: number, teamBId: number): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId: teamAId,
  baseLabel: 'Test game',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 1,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 21,
  scoreB: 14,
  watchability: 50,
});

describe('Performance Index', () => {
  it('rewards identical performance against the stronger rated opponent', () => {
    const entries = [input(1), input(2), input(3), input(4)];
    const indexes = buildPerformanceIndexes(
      entries,
      [game(1, 1, 3), game(2, 2, 4)],
      new Map([[1, 70], [2, 70], [3, 99], [4, 25]]),
    );

    expect(indexes.get(1)!.performanceIndex).toBeGreaterThan(
      indexes.get(2)!.performanceIndex,
    );
  });

  it('uses completed-game performance at full weight immediately', () => {
    const indexes = buildPerformanceIndexes([
      input(1, { offense: unit({ successRate: 0.55 }) }),
      input(2, { offense: unit({ successRate: 0.35 }) }),
    ], [], new Map([[1, 70], [2, 70]]));

    expect(indexes.get(1)!.offensePerformance).toBeCloseTo(57.5);
    expect(indexes.get(1)!.performanceIndex).toBeCloseTo(53.75);
    expect(indexes.get(2)!.offensePerformance).toBeCloseTo(42.5);
  });

  it('does not use the evaluated team’s own rating', () => {
    const entries = [
      input(1, { offense: unit({ successRate: 0.55 }) }),
      input(2, { offense: unit({ successRate: 0.35 }) }),
    ];
    const completed = [game(1, 1, 2)];
    const lower = buildPerformanceIndexes(
      entries,
      completed,
      new Map([[1, 25], [2, 80]]),
    ).get(1)!;
    const higher = buildPerformanceIndexes(
      entries,
      completed,
      new Map([[1, 99], [2, 80]]),
    ).get(1)!;

    expect(higher).toEqual(lower);
  });

  it('keeps zero-game and missing-opportunity results neutral and finite', () => {
    const indexes = buildPerformanceIndexes([
      input(1, {
        games: 0,
        offenseOpportunities: 0,
        defenseOpportunities: 0,
        offense: unit({ pointsPerOpportunity: 0 }),
        defense: unit({ pointsPerOpportunity: 0 }),
      }),
    ], [], new Map([[1, 99]]));

    expect(indexes.get(1)).toEqual({
      performanceIndex: 50,
      offensePerformance: 50,
      defensePerformance: 50,
    });
  });
});
