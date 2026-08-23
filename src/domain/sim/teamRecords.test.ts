import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import type { OddsContext } from '../odds';
import { updateTeamRecords } from './teamRecords';

const team = (id: number, overrides: Partial<Team> = {}) => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  ranking: id,
  rating: 80,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
  wins_over_expectation: 0,
  wins_over_expectation_per_game: 0,
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

describe('team records and wins over expectation', () => {
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

    expect(strongWinner.wins_over_expectation).toBeCloseTo(0.8);
    expect(weakWinner.wins_over_expectation).toBeCloseTo(0.2);
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

    expect(strongLoser.wins_over_expectation).toBeCloseTo(-0.2);
    expect(weakLoser.wins_over_expectation).toBeCloseTo(-0.8);
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

    expect(homeWinner.wins_over_expectation).toBeCloseTo(0.4);
    expect(neutralWinner.wins_over_expectation).toBeCloseTo(0.5);
    expect(awayWinner.wins_over_expectation).toBeCloseTo(0.6);
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
      wins_over_expectation: 1,
      wins_over_expectation_per_game: 0.5,
    });
    expect(loser).toMatchObject({
      totalWins: 0,
      totalLosses: 2,
      confWins: 0,
      confLosses: 2,
      gamesPlayed: 2,
      record: '0-2 (0-2)',
      wins_over_expectation: -1,
      wins_over_expectation_per_game: -0.5,
    });
  });

  it('keeps postseason games out of conference and nonconference splits', () => {
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
