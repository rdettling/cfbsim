import { describe, expect, it } from 'vitest';
import type { GameRecord, PlayRecord } from '../../../../types/db';
import {
  buildTestPlayCall,
  buildTestPlayParticipants,
  buildTestPlayTiming,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../../../../test/fixtures';
import {
  accumulateTeamAggregateStats,
  accumulateTeamAggregateTotals,
  buildTeamAggregateRanks,
  buildTeamAggregateTables,
  projectArchivedTeamAggregateTables,
  projectTeamAggregateStats,
} from './teamAggregates';

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

const play = (overrides: Partial<PlayRecord> = {}): PlayRecord => ({
  id: 1,
  gameId: 1,
  driveId: 1,
  offenseId: 1,
  defenseId: 2,
  startingFP: 25,
  down: 1,
  yardsLeft: 10,
  playType: 'pass',
  yardsGained: 12,
  result: 'pass',
  text: '',
  header: '',
  scoreA: 0,
  scoreB: 0,
  call: buildTestPlayCall({ offense: 'intermediate_pass' }),
  participants: buildTestPlayParticipants({ passerId: 1, targetId: 2, tacklerId: 3 }),
  timing: buildTestPlayTiming(),
  ...overrides,
});

describe('team aggregate statistics', () => {
  it('uses only completed current-season games and assigns plays to offense and defense', () => {
    const teams = [
      buildTestTeam({ gamesPlayed: 1 }),
      buildTestTeam({ id: 2, name: 'Alpha Tech', gamesPlayed: 1 }),
    ];
    const tables = buildTeamAggregateTables(
      teams,
      [
        game(),
        game({ id: 2, year: 2024, scoreA: 99 }),
        game({ id: 3, winnerId: null, scoreA: null, scoreB: null }),
      ],
      [
        play(),
        play({ id: 2, gameId: 2, yardsGained: 80 }),
        play({ id: 3, gameId: 3, yardsGained: 40 }),
      ],
      2025,
    );

    expect(tables.offense['Test State']).toMatchObject({
      games: 1,
      ppg: 21,
      pass_ypg: 12,
    });
    expect(tables.defense['Alpha Tech']).toMatchObject({ ppg: 21, pass_ypg: 12 });
    expect(tables.offense['Alpha Tech'].pass_ypg).toBe(0);
  });

  it('uses direction-aware, stable ordinal ranks', () => {
    const base = accumulateTeamAggregateStats(buildTestTeam({ gamesPlayed: 0 }), [], []);
    const stats = {
      Alpha: { ...base, ppg: 10, turnovers: 0 },
      Beta: { ...base, ppg: 20, turnovers: 2 },
      Gamma: { ...base, ppg: 10, turnovers: 1 },
    };

    const offense = buildTeamAggregateRanks(stats, 'offense');
    const defense = buildTeamAggregateRanks(stats, 'defense');

    expect(offense.get('Beta')?.ppg).toBe(1);
    expect(offense.get('Alpha')?.ppg).toBe(2);
    expect(offense.get('Gamma')?.ppg).toBe(3);
    expect(offense.get('Alpha')?.turnovers).toBe(1);
    expect(defense.get('Alpha')?.ppg).toBe(1);
    expect(defense.get('Beta')?.turnovers).toBe(1);
  });

  it('returns zero for rate statistics with no attempts or games', () => {
    const stats = accumulateTeamAggregateStats(buildTestTeam({ gamesPlayed: 0 }), [], []);

    expect(stats).toMatchObject({
      ppg: 0,
      comp_percent: 0,
      rush_ypc: 0,
      ypp: 0,
    });
  });

  it('separates raw accumulation from projection and reproduces archived output', () => {
    const team = buildTestTeam({ gamesPlayed: 1 });
    const totals = accumulateTeamAggregateTotals(
      team,
      [game()],
      [
        play({ result: 'touchdown', yardsGained: 20 }),
        play({ id: 2, playType: 'run', result: 'run', yardsGained: 5 }),
        play({
          id: 3,
          startingFP: 97,
          yardsLeft: 3,
          playType: 'pass',
          result: 'made two point pass',
          yardsGained: 3,
          call: {
            kind: 'try',
            attempt: 'two_point',
            offense: 'quick_pass',
            defense: 'base',
          },
          timing: { kind: 'try', context: 'regulation', quarter: 1, secondsLeft: 400 },
        }),
      ],
    );

    expect(totals).toMatchObject({
      games: 1,
      points: 21,
      pass_completions: 1,
      pass_attempts: 1,
      pass_yards: 20,
      pass_touchdowns: 1,
      rush_attempts: 1,
      rush_yards: 5,
      plays: 2,
    });
    expect(projectTeamAggregateStats(totals)).toEqual(
      accumulateTeamAggregateStats(team, [game()], [
        play({ result: 'touchdown', yardsGained: 20 }),
        play({ id: 2, playType: 'run', result: 'run', yardsGained: 5 }),
      ]),
    );
    expect(
      projectArchivedTeamAggregateTables(
        [team],
        [buildTestSeasonTeamSnapshot({ offense: totals, defense: totals })],
      ).offense[team.name],
    ).toEqual(projectTeamAggregateStats(totals));
  });
});
