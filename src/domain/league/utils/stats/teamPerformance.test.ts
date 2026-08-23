import { describe, expect, it } from 'vitest';
import type { GameDetailRecord, GameRecord } from '../../../../types/db';
import {
  buildTestPlayCall,
  buildTestPlayParticipants,
  buildTestPlayTiming,
  buildTestTeam,
} from '../../../../test/fixtures';
import {
  buildPerformanceIndexMap,
  buildTeamPerformance,
} from './teamPerformance';

type DetailPlay = GameDetailRecord['drives'][number]['plays'][number];

const play = (overrides: Partial<DetailPlay> = {}): DetailPlay => ({
  startingFP: 65,
  down: 1,
  yardsLeft: 10,
  playType: 'run',
  yardsGained: 5,
  result: 'run',
  text: '',
  header: '',
  scoreA: 0,
  scoreB: 0,
  call: buildTestPlayCall(),
  participants: buildTestPlayParticipants(),
  timing: buildTestPlayTiming(),
  ...overrides,
});

const game = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: 'Test Stadium',
  winnerId: 1,
  baseLabel: 'Week 1',
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
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 21,
  scoreB: 7,
  watchability: 50,
  ...overrides,
});

const detail = (): GameDetailRecord => ({
  gameId: 1,
  year: 2025,
  drives: [
    {
      driveNum: 1,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      result: 'touchdown',
      points: 7,
      scoreAAfter: 7,
      scoreBAfter: 0,
      plays: [
        play({ yardsGained: 5 }),
        play({ down: 2, yardsGained: 7 }),
        play({ down: 3, yardsLeft: 4, yardsGained: 3 }),
        play({ playType: 'pass', yardsGained: 20, result: 'pass' }),
        play({ yardsGained: -2 }),
        play({ playType: 'pass', yardsGained: 0, result: 'interception' }),
      ],
    },
    {
      driveNum: 2,
      offenseId: 2,
      defenseId: 1,
      startingFP: 20,
      result: 'punt',
      points: 0,
      scoreAAfter: 7,
      scoreBAfter: 0,
      plays: [
        play({ startingFP: 20, yardsGained: 2 }),
        play({ startingFP: 22, down: 2, yardsLeft: 8, yardsGained: 2 }),
        play({ startingFP: 24, down: 3, yardsLeft: 6, yardsGained: 0 }),
      ],
    },
  ],
  playerStats: [],
});

describe('completed-game team performance', () => {
  it('calculates the public play metrics and Performance Index', () => {
    const teams = [
      buildTestTeam({ gamesPlayed: 1, record: '1-0 (0-0)', rating: 80 }),
      buildTestTeam({
        id: 2,
        name: 'Alpha Tech',
        gamesPlayed: 1,
        record: '0-1 (0-0)',
        rating: 80,
      }),
    ];
    const rows = buildTeamPerformance(teams, [game()], [detail()]);
    const first = rows.find(row => row.teamId === 1)!;

    expect(first.games).toBe(1);
    expect(first.offense).toMatchObject({
      successRate: 0.5,
      standardDownSuccessRate: 0.4,
      passingDownSuccessRate: 1,
      explosivePlayRate: 1 / 6,
      pointsPerOpportunity: 7,
      havocRate: 2 / 6,
      averageStartingFieldPosition: 25,
      lineYardsPerCarry: 2.65,
      stuffRate: 0.25,
    });
    expect(first.offense.successfulPlayYards).toBeCloseTo(32 / 3);
    expect(first.defense.successRate).toBe(0);
    expect(first.performanceIndex).toBeGreaterThan(50);
    expect(first.offensePerformance).toBeGreaterThan(50);
    expect(first.defensePerformance).toBeGreaterThan(50);
    expect(buildPerformanceIndexMap(teams, [game()], [detail()]).get(1))
      .toBe(first.performanceIndex);
  });

  it('ignores incomplete games and unrelated details', () => {
    const teams = [
      buildTestTeam({ gamesPlayed: 0 }),
      buildTestTeam({ id: 2, name: 'Alpha Tech', gamesPlayed: 0 }),
    ];
    const rows = buildTeamPerformance(
      teams,
      [game({ winnerId: null, scoreA: null, scoreB: null })],
      [detail(), { ...detail(), gameId: 99 }],
    );

    expect(rows.map(row => row.teamId)).toEqual([1, 2]);
    expect(rows.every(row => row.games === 0)).toBe(true);
    expect(rows.every(row => row.performanceIndex === 50)).toBe(true);
    expect(rows.every(row => row.offense.successRate === 0)).toBe(true);
  });
});
