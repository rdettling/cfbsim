import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import { buildResumeComparisonTeams } from './resumeComparison';

const game = (
  id: number,
  teamAId: number,
  teamBId: number,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId: teamAId,
  baseLabel: 'Regular Season',
  name: null,
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
  scoreA: 24,
  scoreB: 17,
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: 50,
});

const buildRows = (teams: ReturnType<typeof buildTestTeam>[], games: GameRecord[] = []) => {
  const league = buildTestLeague('season', { teams });
  return buildResumeComparisonTeams({
    league,
    games,
    details: [],
    selection: { order: teams, autobidIds: new Set() },
    championIds: new Set(),
  });
};

describe('resume comparison rankings', () => {
  it('orders the fixed table by Poll Score and ranks the replacement metrics', () => {
    const teams = [
      buildTestTeam({
        id: 1,
        name: 'Best Resume',
        ranking: 3,
        poll_score: 80,
        totalWins: 12,
        totalLosses: 0,
        gamesPlayed: 12,
        wins_over_expectation_per_game: 0.2,
      }),
      buildTestTeam({
        id: 2,
        name: 'Poll Leader',
        ranking: 2,
        poll_score: 90,
        totalWins: 8,
        totalLosses: 4,
        gamesPlayed: 12,
        wins_over_expectation_per_game: 0,
      }),
      buildTestTeam({
        id: 3,
        name: 'Third Team',
        ranking: 1,
        poll_score: 70,
        totalWins: 6,
        totalLosses: 6,
        gamesPlayed: 12,
        wins_over_expectation_per_game: -0.1,
      }),
    ];

    const rows = buildRows(teams);

    expect(rows.map(row => row.name)).toEqual(['Poll Leader', 'Best Resume', 'Third Team']);
    expect(rows.map(row => row.ranking)).toEqual([1, 2, 3]);
    expect(rows.find(row => row.name === 'Best Resume')?.resumeScoreRank).toBe(1);
    expect(rows.every(row => Number.isInteger(row.performanceIndexRank))).toBe(true);
  });

  it('ranks Performance Index from the shared opponent-adjusted calculation', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Strong Schedule', rating: 70, poll_score: 90 }),
      buildTestTeam({ id: 2, name: 'Weak Schedule', rating: 70, poll_score: 80 }),
      buildTestTeam({ id: 3, name: 'Strong Opponent', rating: 99, poll_score: 70 }),
      buildTestTeam({ id: 4, name: 'Weak Opponent', rating: 25, poll_score: 60 }),
    ];

    const rows = buildRows(teams, [game(1, 1, 3), game(2, 2, 4)]);
    const strongSchedule = rows.find(row => row.name === 'Strong Schedule')!;
    const weakSchedule = rows.find(row => row.name === 'Weak Schedule')!;

    expect(strongSchedule.performanceIndexRank).toBeLessThan(
      weakSchedule.performanceIndexRank,
    );
  });

  it('uses Poll Score rank for Top 25 records and best and worst results', () => {
    const teams = Array.from({ length: 30 }, (_, index) => {
      const id = index + 1;
      return buildTestTeam({
        id,
        name: `Team ${id}`,
        ranking: 31 - id,
        poll_score: 101 - id,
      });
    });
    const rows = buildRows(teams, [
      game(1, 1, 5),
      game(2, 1, 20),
      game(3, 10, 1),
      game(4, 28, 1),
    ]);

    expect(rows[0]).toMatchObject({
      name: 'Team 1',
      top25Record: '2-1',
      bestWin: { opponent: 'Team 5', opponentRanking: 5 },
      worstLoss: { opponent: 'Team 28', opponentRanking: 28 },
    });
  });
});
