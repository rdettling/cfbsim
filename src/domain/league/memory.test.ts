import { describe, expect, it } from 'vitest';
import type { GameLogRecord, GameRecord } from '../../types/db';
import { buildTestLeague, buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import { buildSeasonMemory } from './memory';

const game = (
  id: number,
  name: string,
  winnerId = 1,
  gameType: GameRecord['gameType'] = 'regular_season',
): GameRecord => ({
  id,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: name,
  name,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: id,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === 1 ? 'W' : 'L',
  resultB: winnerId === 2 ? 'W' : 'L',
  overtime: 0,
  scoreA: 31,
  scoreB: 24,
  gameType,
  rivalryKey: null,
  watchability: 80,
});

const log: GameLogRecord = {
  playerId: 1,
  gameId: 13,
  pass_yards: 350,
  pass_attempts: 30,
  pass_completions: 22,
  pass_touchdowns: 4,
  pass_interceptions: 1,
  rush_yards: 20,
  rush_attempts: 5,
  rush_touchdowns: 1,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
};

describe('buildSeasonMemory', () => {
  it('captures typed postseason facts and structured award totals', () => {
    const teamA = buildTestTeam();
    const teamB = buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH' });
    const league = buildTestLeague('summary', {
      teams: [teamA, teamB],
      conferences: [{
        id: 1,
        confName: 'Test Conference',
        confFullName: 'Test Conference',
        confGames: 8,
        info: '',
        championship: 10,
        teams: [teamA, teamB],
      }],
      playoff: { seeds: [1, 2], left_semi: 12, natty: 13 },
    });
    const memory = buildSeasonMemory(
      league,
      [
        game(10, 'Test Conference championship', 1, 'conference_championship'),
        game(11, 'Rose Bowl', 1, 'bowl'),
        game(12, 'Playoff semifinal', 1, 'playoff_semifinal'),
        game(13, 'National Championship', 1, 'national_championship'),
      ],
      [buildTestPlayer()],
      [log],
    );

    expect(memory.events).toEqual([
      { type: 'conference_championship', gameId: 10, conferenceName: 'Test Conference' },
      { type: 'bowl', gameId: 11, bowlName: 'Rose Bowl' },
      { type: 'playoff_semifinal', gameId: 12 },
      { type: 'national_championship', gameId: 13 },
    ]);
    expect(memory.teamSnapshots).toEqual([
      {
        teamId: 1,
        rating: 80,
        prestige: 4,
        ranking: 1,
        record: '12-0 (8-0)',
      },
      {
        teamId: 2,
        rating: 80,
        prestige: 4,
        ranking: 1,
        record: '12-0 (8-0)',
      },
    ]);
    expect(memory.awards[0]).toMatchObject({
      categorySlug: 'heisman',
      playerId: 1,
      teamId: 1,
    });
    expect(memory).not.toHaveProperty('last_updated');
  });
});
