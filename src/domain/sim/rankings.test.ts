import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { GameRecord } from '../../types/db';
import type { Info, PlayoffTeamCount, Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { SimGame } from '../../types/sim';
import { BOWL_WEEK } from '../league/postseason';
import type { OddsContext } from '../odds';
import {
  finalizePostseasonRankings,
  updateRankings,
  updateTeamRecords,
} from './rankings';

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

const team = (id: number, overrides: Partial<Team> = {}) => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  ranking: id,
  last_rank: id,
  rating: 80,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
  poll_score: 0,
  strength_of_record: 0,
  strength_of_record_avg: 0,
  ...overrides,
});

const game = ({
  id,
  teamA,
  teamB,
  winner,
  homeTeam = null,
  neutralSite = homeTeam === null,
  gameType = 'regular_season',
}: {
  id: number;
  teamA: Team;
  teamB: Team;
  winner: Team | null;
  homeTeam?: Team | null;
  neutralSite?: boolean;
  gameType?: SimGame['gameType'];
}): SimGame => ({
  id,
  teamA,
  teamB,
  homeTeam: neutralSite ? null : homeTeam,
  awayTeam: neutralSite ? null : homeTeam?.id === teamA.id ? teamB : teamA,
  neutralSite,
  venue: null,
  winner,
  baseLabel: `${teamA.name} vs ${teamB.name}`,
  name: null,
  gameType,
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 1,
  year: 2026,
  rankATOG: teamA.ranking,
  rankBTOG: teamB.ranking,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  clockRunning: false,
  timeoutsRemainingA: 0,
  timeoutsRemainingB: 0,
  scoreA: 0,
  scoreB: 0,
  watchability: null,
});

const info = (currentWeek: number): Info => ({
  currentWeek,
  lastRankingsWeek: currentWeek - 1,
  currentYear: 2026,
  startYear: 2026,
  stage: 'season',
  team: 'Team 1',
  lastWeek: 19,
});

const settings = (
  playoffTeams: PlayoffTeamCount,
): LeagueState['settings'] => ({
  conferencePolicy: 'historical',
  postseasonPolicy: 'custom',
  playoffTeams,
  playoffAutobids: playoffTeams === 12 ? 5 : 0,
  conferenceChampionsReceiveTopSeeds: false,
});

const natty = (winnerId: number, teamAId: number, teamBId: number): GameRecord => ({
  id: 1,
  teamAId,
  teamBId,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: 'National Championship',
  name: 'National Championship',
  gameType: 'national_championship',
  rivalryKey: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 19,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: winnerId === teamAId ? 28 : 21,
  scoreB: winnerId === teamBId ? 28 : 21,
  watchability: 100,
});

describe('ranking strength of record', () => {
  it('rewards strong-opponent wins more than weak-opponent wins', () => {
    const strongWinner = team(1);
    const strongOpponent = team(2, { rating: 100 });
    const weakWinner = team(3);
    const weakOpponent = team(4, { rating: 60 });
    const teams = [strongWinner, strongOpponent, weakWinner, weakOpponent];

    updateTeamRecords([
      game({ id: 1, teamA: strongWinner, teamB: strongOpponent, winner: strongWinner }),
      game({ id: 2, teamA: weakWinner, teamB: weakOpponent, winner: weakWinner }),
    ], teams, oddsContext);

    expect(strongWinner.strength_of_record).toBeCloseTo(0.8);
    expect(weakWinner.strength_of_record).toBeCloseTo(0.2);
  });

  it('penalizes weak-opponent losses more than strong-opponent losses', () => {
    const strongLoser = team(1);
    const strongOpponent = team(2, { rating: 100 });
    const weakLoser = team(3);
    const weakOpponent = team(4, { rating: 60 });
    const teams = [strongLoser, strongOpponent, weakLoser, weakOpponent];

    updateTeamRecords([
      game({ id: 1, teamA: strongLoser, teamB: strongOpponent, winner: strongOpponent }),
      game({ id: 2, teamA: weakLoser, teamB: weakOpponent, winner: weakOpponent }),
    ], teams, oddsContext);

    expect(strongLoser.strength_of_record).toBeCloseTo(-0.2);
    expect(weakLoser.strength_of_record).toBeCloseTo(-0.8);
  });

  it('accounts for home, neutral, and away difficulty', () => {
    const homeWinner = team(1);
    const homeOpponent = team(2);
    const neutralWinner = team(3);
    const neutralOpponent = team(4);
    const awayWinner = team(5);
    const awayOpponent = team(6);
    const teams = [
      homeWinner,
      homeOpponent,
      neutralWinner,
      neutralOpponent,
      awayWinner,
      awayOpponent,
    ];

    updateTeamRecords([
      game({
        id: 1,
        teamA: homeWinner,
        teamB: homeOpponent,
        winner: homeWinner,
        homeTeam: homeWinner,
      }),
      game({
        id: 2,
        teamA: neutralWinner,
        teamB: neutralOpponent,
        winner: neutralWinner,
      }),
      game({
        id: 3,
        teamA: awayWinner,
        teamB: awayOpponent,
        winner: awayWinner,
        homeTeam: awayOpponent,
      }),
    ], teams, oddsContext);

    expect(homeWinner.strength_of_record).toBeCloseTo(0.4);
    expect(neutralWinner.strength_of_record).toBeCloseTo(0.5);
    expect(awayWinner.strength_of_record).toBeCloseTo(0.6);
  });

  it('updates cumulative records and ignores incomplete games', () => {
    const winner = team(1);
    const loser = team(2);

    updateTeamRecords([
      game({ id: 1, teamA: winner, teamB: loser, winner }),
      game({ id: 2, teamA: winner, teamB: loser, winner }),
      game({ id: 3, teamA: winner, teamB: loser, winner: null }),
    ], [winner, loser], oddsContext);

    expect(winner).toMatchObject({
      totalWins: 2,
      totalLosses: 0,
      confWins: 2,
      confLosses: 0,
      gamesPlayed: 2,
      record: '2-0 (2-0)',
      strength_of_record: 1,
      strength_of_record_avg: 0.5,
    });
    expect(loser).toMatchObject({
      totalWins: 0,
      totalLosses: 2,
      confWins: 0,
      confLosses: 2,
      gamesPlayed: 2,
      record: '0-2 (0-2)',
      strength_of_record: -1,
      strength_of_record_avg: -0.5,
    });
  });

  it('keeps every postseason game out of conference and nonconference splits', () => {
    const winner = team(1);
    const loser = team(2);

    updateTeamRecords([
      game({
        id: 1,
        teamA: winner,
        teamB: loser,
        winner,
        gameType: 'conference_championship',
      }),
    ], [winner, loser], oddsContext);

    expect(winner).toMatchObject({
      totalWins: 1,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
    });
    expect(loser).toMatchObject({
      totalLosses: 1,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
    });
  });
});

describe('weekly rankings', () => {
  it.each([
    { week: 1, firstScore: 92.857, secondScore: 7.143, order: [1, 2] },
    { week: 7, firstScore: 50, secondScore: 50, order: [1, 2] },
    { week: 14, firstScore: 0, secondScore: 99.9, order: [2, 1] },
  ])(
    'blends prior rank and normalized SOR after Week $week',
    ({ week, firstScore, secondScore, order }) => {
      const first = team(1, { ranking: 1, last_rank: 1, strength_of_record_avg: -1 });
      const second = team(2, { ranking: 2, last_rank: 2, strength_of_record_avg: 1 });
      const teams = [first, second];

      updateRankings(info(week), teams, settings(12));

      expect(first.poll_score).toBe(firstScore);
      expect(second.poll_score).toBe(secondScore);
      expect([...teams].sort((left, right) => left.ranking - right.ranking)
        .map(entry => entry.id)).toEqual(order);
    },
  );

  it('allows only the previous No. 1 with the best SOR to score 100', () => {
    const first = team(1, { ranking: 1, strength_of_record_avg: 1 });
    const second = team(2, { ranking: 2, strength_of_record_avg: 1 });
    const third = team(3, { ranking: 3, strength_of_record_avg: 0 });

    updateRankings(info(14), [first, second, third], settings(12));

    expect(first.poll_score).toBe(100);
    expect(second.poll_score).toBe(99.9);
  });

  it.each([
    { playoffTeams: 4 as const, week: BOWL_WEEK },
    { playoffTeams: 12 as const, week: BOWL_WEEK },
    { playoffTeams: 12 as const, week: BOWL_WEEK + 1 },
    { playoffTeams: 12 as const, week: BOWL_WEEK + 2 },
  ])(
    'freezes the $playoffTeams-team rankings in Week $week',
    ({ playoffTeams, week }) => {
      const teams = [
        team(1, { ranking: 1, poll_score: 80, strength_of_record_avg: -1 }),
        team(2, { ranking: 2, poll_score: 20, strength_of_record_avg: 1 }),
      ];
      const before = structuredClone(teams);

      expect(updateRankings(info(week), teams, settings(playoffTeams))).toEqual([]);
      expect(teams).toEqual(before);
    },
  );

  it.each([
    { playoffTeams: 2 as const, week: 16 },
    { playoffTeams: 4 as const, week: 17 },
    { playoffTeams: 12 as const, week: 19 },
  ])(
    'updates the $playoffTeams-team rankings in non-frozen Week $week',
    ({ playoffTeams, week }) => {
      const teams = [
        team(1, { ranking: 1, strength_of_record_avg: -1 }),
        team(2, { ranking: 2, strength_of_record_avg: 1 }),
      ];

      expect(updateRankings(info(week), teams, settings(playoffTeams))).toHaveLength(2);
      expect(teams.find(entry => entry.id === 2)?.ranking).toBe(1);
    },
  );

  it('handles empty and single-team leagues deterministically', () => {
    expect(updateRankings(info(7), [], settings(2))).toEqual([]);

    const onlyTeam = team(1);
    const updates = updateRankings(info(7), [onlyTeam], settings(2));

    expect(updates).toHaveLength(1);
    expect(onlyTeam.ranking).toBe(1);
    expect(onlyTeam.poll_score).toBe(75);
    expect(Number.isFinite(onlyTeam.poll_score)).toBe(true);
  });
});

describe('final postseason rankings', () => {
  it('forces the finalists into the top two and normalizes final poll scores', () => {
    const champion = team(1, {
      ranking: 4,
      last_rank: 4,
      totalWins: 5,
      totalLosses: 5,
      strength_of_record: -5,
      strength_of_record_avg: -0.5,
    });
    const runnerUp = team(2, {
      ranking: 3,
      last_rank: 3,
      totalWins: 6,
      totalLosses: 4,
      strength_of_record: -2,
      strength_of_record_avg: -0.2,
    });
    const bestRemaining = team(3, {
      ranking: 2,
      last_rank: 2,
      totalWins: 9,
      totalLosses: 1,
      strength_of_record: 5,
      strength_of_record_avg: 0.5,
    });
    const other = team(4, {
      ranking: 1,
      last_rank: 1,
      totalWins: 8,
      totalLosses: 2,
      strength_of_record: 2,
      strength_of_record_avg: 0.2,
    });
    const teams = [champion, runnerUp, bestRemaining, other];

    finalizePostseasonRankings(teams, natty(champion.id, champion.id, runnerUp.id));

    expect([...teams].sort((left, right) => left.ranking - right.ranking)
      .map(entry => entry.id)).toEqual([1, 2, 3, 4]);
    expect(teams.map(entry => entry.poll_score)).toEqual([
      100,
      66.667,
      33.333,
      0,
    ]);
  });

  it('orders non-finalists by average SOR rather than cumulative SOR', () => {
    const champion = team(1, { totalWins: 14, totalLosses: 2 });
    const runnerUp = team(2, { totalWins: 12, totalLosses: 3 });
    const lowerTotal = team(3, {
      ranking: 4,
      last_rank: 4,
      totalWins: 11,
      totalLosses: 3,
      strength_of_record: 6.3,
      strength_of_record_avg: 0.45,
    });
    const higherTotal = team(4, {
      ranking: 3,
      last_rank: 3,
      totalWins: 12,
      totalLosses: 3,
      strength_of_record: 6.7,
      strength_of_record_avg: 0.447,
    });
    const teams = [champion, runnerUp, lowerTotal, higherTotal];

    finalizePostseasonRankings(teams, natty(champion.id, champion.id, runnerUp.id));

    expect(lowerTotal.strength_of_record).toBeLessThan(higherTotal.strength_of_record);
    expect(lowerTotal.ranking).toBe(3);
    expect(higherTotal.ranking).toBe(4);
  });

  it('orders every team by average SOR when the championship is incomplete', () => {
    const lower = team(1, {
      ranking: 1,
      last_rank: 1,
      strength_of_record_avg: 0.2,
    });
    const higher = team(2, {
      ranking: 3,
      last_rank: 3,
      strength_of_record_avg: 0.5,
    });
    const middle = team(3, {
      ranking: 2,
      last_rank: 2,
      strength_of_record_avg: 0.3,
    });
    const teams = [lower, higher, middle];

    finalizePostseasonRankings(teams, null);

    expect([...teams].sort((left, right) => left.ranking - right.ranking)
      .map(entry => entry.id)).toEqual([2, 3, 1]);
    expect(teams.map(entry => entry.poll_score)).toEqual([0, 100, 50]);
  });
});
