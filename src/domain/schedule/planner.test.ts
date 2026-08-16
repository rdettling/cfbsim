import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { GameRecord } from '../../types/db';
import type { FullGame } from '../../types/scheduleTypes';
import {
  assertCompleteSchedule,
  buildFullScheduleFromExisting,
} from './planner';
import { isConferenceGame } from './matchups';
import { preservesScheduleCapacityWithOpponent } from './feasibility';

const plannerOptions = (seed: number) => ({
  year: 2025,
  seed,
  requireComplete: true,
});

const buildTeam = (id: number, conference: string): Team => buildTestTeam({
  id,
  name: `${conference} Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit: 11,
  nonConfGames: 0,
  nonConfLimit: 1,
  ranking: id,
  offense: 90,
  defense: 90,
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
  strength_of_record_avg: 0,
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

const conferenceHomeAwayCounts = (teams: Team[], games: ReturnType<
  typeof buildFullScheduleFromExisting
>['fullGames']) => {
  const counts = new Map(teams.map(team => [team.id, { home: 0, away: 0 }]));
  games.filter(game => isConferenceGame(game.teamA, game.teamB)).forEach(game => {
    if (game.homeTeam) counts.get(game.homeTeam.id)!.home += 1;
    if (game.awayTeam) counts.get(game.awayTeam.id)!.away += 1;
  });
  return counts;
};

const conferenceSiteSignature = (games: ReturnType<
  typeof buildFullScheduleFromExisting
>['fullGames']) => games
  .filter(game => isConferenceGame(game.teamA, game.teamB))
  .map(game => [
    Math.min(game.teamA.id, game.teamB.id),
    Math.max(game.teamA.id, game.teamB.id),
    game.homeTeam?.id ?? null,
  ])
  .sort((left, right) =>
    Number(left[0]) - Number(right[0]) ||
    Number(left[1]) - Number(right[1])
  );

const matchupSignature = (games: ReturnType<
  typeof buildFullScheduleFromExisting
>['fullGames']) => games
  .map(game => [
    Math.min(game.teamA.id, game.teamB.id),
    Math.max(game.teamA.id, game.teamB.id),
  ])
  .sort((left, right) => left[0] - right[0] || left[1] - right[1]);

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

    const conferenceCounts = conferenceHomeAwayCounts(teams, first.fullGames);
    teams.forEach(team => {
      const counts = conferenceCounts.get(team.id)!;
      expect(Math.abs(counts.home - counts.away)).toBeLessThanOrEqual(1);
      if (team.confLimit % 2 === 0) expect(counts.home).toBe(counts.away);
    });
    const conferenceHomePenalty = teams.reduce((total, team) => {
      const home = conferenceCounts.get(team.id)!.home;
      return total + (home - 6) ** 2;
    }, 0);
    const totalHomeCounts = new Map(teams.map(team => [team.id, 0]));
    first.fullGames.forEach(game => {
      if (game.homeTeam) {
        totalHomeCounts.set(
          game.homeTeam.id,
          (totalHomeCounts.get(game.homeTeam.id) ?? 0) + 1,
        );
      }
    });
    const completedHomePenalty = teams.reduce(
      (total, team) => total + ((totalHomeCounts.get(team.id) ?? 0) - 6) ** 2,
      0,
    );
    expect(completedHomePenalty).toBeLessThanOrEqual(conferenceHomePenalty);

    const conferenceGames = first.fullGames.filter(game =>
      isConferenceGame(game.teamA, game.teamB)
    );
    const automaticNonConferenceGames = first.fullGames.filter(game =>
      !isConferenceGame(game.teamA, game.teamB)
    );
    let optimalHomePenalty = Number.POSITIVE_INFINITY;
    for (
      let mask = 0;
      mask < 2 ** automaticNonConferenceGames.length;
      mask += 1
    ) {
      const candidateHomeCounts = new Map(teams.map(team => [team.id, 0]));
      conferenceGames.forEach(game => {
        if (game.homeTeam) {
          candidateHomeCounts.set(
            game.homeTeam.id,
            candidateHomeCounts.get(game.homeTeam.id)! + 1,
          );
        }
      });
      automaticNonConferenceGames.forEach((game, index) => {
        const homeTeam = mask & (1 << index) ? game.teamA : game.teamB;
        candidateHomeCounts.set(
          homeTeam.id,
          candidateHomeCounts.get(homeTeam.id)! + 1,
        );
      });
      optimalHomePenalty = Math.min(
        optimalHomePenalty,
        teams.reduce(
          (total, team) =>
            total + (candidateHomeCounts.get(team.id)! - 6) ** 2,
          0,
        ),
      );
    }
    expect(completedHomePenalty).toBe(optimalHomePenalty);

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

  it('keeps conference sites independent from a manual nonconference site', () => {
    const homeTeams = buildLargeConferenceTeams();
    const homeResult = buildFullScheduleFromExisting(
      homeTeams[0],
      homeTeams,
      [fixedGame(1, 14, 2)],
      plannerOptions(250),
    );
    const awayTeams = buildLargeConferenceTeams();
    const awayResult = buildFullScheduleFromExisting(
      awayTeams[0],
      awayTeams,
      [fixedGame(1, 14, 2, { homeTeamId: 14, awayTeamId: 1 })],
      plannerOptions(250),
    );

    assertCompleteSchedule(homeTeams, homeResult.fullGames);
    assertCompleteSchedule(awayTeams, awayResult.fullGames);
    expect(matchupSignature(awayResult.fullGames)).toEqual(
      matchupSignature(homeResult.fullGames),
    );
    expect(conferenceSiteSignature(awayResult.fullGames)).toEqual(
      conferenceSiteSignature(homeResult.fullGames),
    );
    expect(
      homeResult.fullGames.find(game =>
        Math.min(game.teamA.id, game.teamB.id) === 1 &&
        Math.max(game.teamA.id, game.teamB.id) === 14
      )?.homeTeam?.id,
    ).toBe(1);
    expect(
      awayResult.fullGames.find(game =>
        Math.min(game.teamA.id, game.teamB.id) === 1 &&
        Math.max(game.teamA.id, game.teamB.id) === 14
      )?.homeTeam?.id,
    ).toBe(14);
  });

  it('preserves a required neutral rivalry venue through generated outputs', () => {
    const teams = buildLargeConferenceTeams();
    const requiredGame: FullGame = {
      teamA: teams[0],
      teamB: teams[13],
      weekPlayed: 0,
      homeTeam: null,
      awayTeam: null,
      venue: 'Test Bowl',
      name: 'Neutral Rivalry',
      rivalryKey: 'neutral-rivalry',
    };

    const result = buildFullScheduleFromExisting(
      teams[0],
      teams,
      [],
      { ...plannerOptions(275), requiredGames: [requiredGame] },
    );
    const fullGame = result.fullGames.find(game =>
      game.rivalryKey === requiredGame.rivalryKey
    );
    const newGame = result.newGames.find(game =>
      game.rivalryKey === requiredGame.rivalryKey
    );

    expect(fullGame).toMatchObject({
      homeTeam: null,
      awayTeam: null,
      venue: 'Test Bowl',
      name: 'Neutral Rivalry',
    });
    expect(fullGame?.weekPlayed).toBeGreaterThan(0);
    expect(newGame?.venue).toBe('Test Bowl');
    expect(requiredGame.weekPlayed).toBe(0);
    expect(result.schedule[(fullGame?.weekPlayed ?? 1) - 1]).toMatchObject({
      location: 'Neutral',
      venue: 'Test Bowl',
      label: 'Neutral Rivalry',
    });
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
