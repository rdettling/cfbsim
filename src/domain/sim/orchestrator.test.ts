import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { GameRecord } from '../../types/db';
import { completeRankingsForWeek } from './orchestrator';

const game = (id: number, week: number, winnerId: number | null): GameRecord => ({
  id,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId,
  baseLabel: 'Team 1 vs Team 2',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: week,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId ? 'W' : null,
  resultB: winnerId ? 'L' : null,
  overtime: 0,
  quarter: winnerId ? 4 : 1,
  clockSecondsLeft: winnerId ? 0 : 900,
  scoreA: winnerId ? 28 : null,
  scoreB: winnerId ? 17 : null,
  watchability: 50,
});

describe('week completion rankings', () => {
  it('commits a completed poll update even when no story qualifies', () => {
    const teams = Array.from({ length: 30 }, (_, index) => buildTestTeam({
      id: index + 1,
      name: `Team ${index + 1}`,
      ranking: index + 1,
      last_rank: index + 1,
      poll_score: 100 - index,
      wins_over_expectation_per_game: 0,
    }));
    const league = buildTestLeague('season', {
      info: {
        currentWeek: 4,
        lastRankingsWeek: 3,
        currentYear: 2026,
        startYear: 2026,
        stage: 'season',
        team: teams[0].name,
        lastWeek: 19,
      },
      teams,
    });
    const games = [game(1, 4, 1), game(2, 5, null)];
    const teamsById = new Map(teams.map(team => [team.id, team]));

    const first = completeRankingsForWeek(league, games, [], teamsById);
    expect(first).toEqual({ completed: true, story: null });
    expect(league.info.lastRankingsWeek).toBe(4);
    expect(games[1].rankATOG).toBe(teams[0].ranking);
    expect(games[1].rankBTOG).toBe(teams[1].ranking);
    expect(completeRankingsForWeek(league, games, [], teamsById))
      .toEqual({ completed: false, story: null });
  });
});
