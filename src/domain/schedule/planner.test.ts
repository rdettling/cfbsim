import { describe, expect, it } from 'vitest';
import type { Team } from '../../types/domain';
import type { GameRecord } from '../../types/db';
import {
  assertCompleteSchedule,
  buildFullScheduleFromExisting,
} from './planner';
import { preservesScheduleCapacityWithOpponent } from './feasibility';

const plannerOptions = (seed: number) => ({
  year: 2025,
  seed,
  requireComplete: true,
});

const buildTeam = (id: number, conference: string): Team => ({
  id,
  name: `${conference} Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit: 11,
  nonConfGames: 0,
  nonConfLimit: 1,
  prestige: 4,
  prestige_change: 0,
  ceiling: 7,
  floor: 1,
  mascot: 'Testers',
  city: 'Test City',
  state: 'TS',
  stadium: 'Test Stadium',
  ranking: id,
  offense: 90,
  defense: 90,
  colorPrimary: '#123456',
  colorSecondary: '#ffffff',
  conference,
  confName: conference,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  rating: 90,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
  movement: 0,
  poll_score: 0,
  strength_of_record: 0,
  last_game: null,
  next_game: null,
});

const buildLargeConferenceTeams = () => [
  ...Array.from({ length: 13 }, (_, index) => buildTeam(index + 1, 'East')),
  ...Array.from({ length: 13 }, (_, index) => buildTeam(index + 14, 'West')),
];

const fixedGame = (
  teamAId: number,
  teamBId: number,
  weekPlayed: number,
  overrides: Partial<GameRecord> = {},
): GameRecord => ({
  id: weekPlayed,
  teamAId,
  teamBId,
  weekPlayed,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId: null,
  baseLabel: '',
  name: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  year: 2025,
  rankATOG: 0,
  rankBTOG: 0,
  resultA: null,
  resultB: null,
  overtime: 0,
  scoreA: null,
  scoreB: null,
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: null,
  ...overrides,
});

const scheduleSignature = (
  games: ReturnType<typeof buildFullScheduleFromExisting>['fullGames'],
) =>
  games
    .map(game => [
      game.teamA.id,
      game.teamB.id,
      game.weekPlayed,
      game.homeTeam?.id ?? null,
      game.awayTeam?.id ?? null,
    ])
    .sort((left, right) =>
      Number(left[0]) - Number(right[0]) ||
      Number(left[1]) - Number(right[1]) ||
      Number(left[2]) - Number(right[2]),
    );

describe('seeded complete scheduling', () => {
  it('rotates one reduced slot for odd conference target totals and gives everyone 12 games', () => {
    const teams = buildLargeConferenceTeams();
    const first = buildFullScheduleFromExisting(
      teams[0],
      teams,
      [],
      plannerOptions(100),
    );
    assertCompleteSchedule(teams, first.fullGames);

    const reducedByConference = new Map<string, number>();
    for (const conference of ['East', 'West']) {
      const members = teams.filter(team => team.conference === conference);
      expect(members.filter(team => team.confLimit === 10)).toHaveLength(1);
      expect(members.filter(team => team.confLimit === 11)).toHaveLength(12);
      reducedByConference.set(
        conference,
        members.find(team => team.confLimit === 10)!.id,
      );
    }

    const repeatedTeams = buildLargeConferenceTeams();
    const repeated = buildFullScheduleFromExisting(
      repeatedTeams[0],
      repeatedTeams,
      [],
      plannerOptions(100),
    );
    expect(scheduleSignature(repeated.fullGames)).toEqual(
      scheduleSignature(first.fullGames),
    );

    const variedTeams = buildLargeConferenceTeams();
    const varied = buildFullScheduleFromExisting(
      variedTeams[0],
      variedTeams,
      [],
      plannerOptions(200),
    );
    assertCompleteSchedule(variedTeams, varied.fullGames);
    expect(scheduleSignature(varied.fullGames)).not.toEqual(
      scheduleSignature(first.fullGames),
    );
    for (const conference of ['East', 'West']) {
      expect(
        variedTeams.find(
          team => team.conference === conference && team.confLimit === 10,
        )?.id,
      ).toBe(reducedByConference.get(conference));
    }
  });

  it('preserves fixed games and their sites across schedule seeds', () => {
    const existing = [fixedGame(1, 14, 7, {
      homeTeamId: 14,
      awayTeamId: 1,
      name: 'Fixed matchup',
    })];

    for (const seed of [300, 400]) {
      const teams = buildLargeConferenceTeams();
      const result = buildFullScheduleFromExisting(
        teams[0],
        teams,
        existing,
        plannerOptions(seed),
      );
      assertCompleteSchedule(teams, result.fullGames);
      expect(
        result.fullGames.find(
          game =>
            (game.teamA.id === 1 && game.teamB.id === 14) ||
            (game.teamA.id === 14 && game.teamB.id === 1),
        ),
      ).toMatchObject({
        weekPlayed: 7,
        homeTeam: { id: 14 },
        awayTeam: { id: 1 },
        name: 'Fixed matchup',
      });
    }
  });

  it('rejects a manual nonconference choice that exceeds residual capacity', () => {
    const teams = buildLargeConferenceTeams();
    teams.forEach(team => {
      team.confLimit = 12;
      team.nonConfLimit = 0;
    });
    const existing = [fixedGame(1, 14, 2)];
    expect(
      preservesScheduleCapacityWithOpponent({
        teams,
        userTeamId: 1,
        opponentId: 15,
        week: 1,
        existingGames: existing,
        year: 2025,
      }),
    ).toBe(false);
  });
});
