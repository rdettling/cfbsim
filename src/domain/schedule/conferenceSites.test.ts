import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { FullGame, UnorientedMatchup } from '../../types/scheduleTypes';
import { orientConferenceMatchups } from './conferenceSites';

const team = (id: number, conference = 'Test'): Team => buildTestTeam({
  id,
  name: `${conference} Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit: 8,
  nonConfGames: 0,
  nonConfLimit: 4,
  ranking: 0,
  offense: 75,
  defense: 75,
  conference,
  confName: conference,
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  rating: 75,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0 (0-0)',
  movement: 0,
  poll_score: 0,
  wins_over_expectation: 0,
  wins_over_expectation_per_game: 0,
  last_game: null,
  next_game: null,
});

const matchup = (teamA: Team, teamB: Team): UnorientedMatchup => ({ teamA, teamB });

const fixedGame = (
  teamA: Team,
  teamB: Team,
  homeTeam: Team | null,
  awayTeam: Team | null,
): FullGame => ({
  teamA,
  teamB,
  weekPlayed: 1,
  homeTeam,
  awayTeam,
  venue: homeTeam ? null : 'Neutral Stadium',
  name: 'Fixed game',
  rivalryKey: `${teamA.id}:${teamB.id}`,
});

const homeAwayCounts = (teams: Team[], games: FullGame[]) => {
  const counts = new Map(teams.map(entry => [entry.id, { home: 0, away: 0 }]));
  games.forEach(game => {
    const home = game.homeTeam ? counts.get(game.homeTeam.id) : undefined;
    const away = game.awayTeam ? counts.get(game.awayTeam.id) : undefined;
    if (home) home.home += 1;
    if (away) away.away += 1;
  });
  return counts;
};

const signature = (games: FullGame[]) => games.map(game => [
  game.teamA.id,
  game.teamB.id,
  game.homeTeam?.id ?? null,
]);

const squaredImbalance = (teams: Team[], games: FullGame[]) => {
  const counts = homeAwayCounts(teams, games);
  return teams.reduce((total, entry) => {
    const teamCounts = counts.get(entry.id)!;
    return total + (teamCounts.home - teamCounts.away) ** 2;
  }, 0);
};

describe('conference site orientation', () => {
  it('gives every team an exact split for an even conference slate', () => {
    const teams = Array.from({ length: 9 }, (_, index) => team(index + 1));
    const matchups = teams.flatMap((teamA, index) =>
      teams.slice(index + 1).map(teamB => matchup(teamA, teamB))
    );

    const games = orientConferenceMatchups({
      matchups,
      fixedGames: [],
      year: 2025,
      seed: 100,
    });
    const counts = homeAwayCounts(teams, games);

    teams.forEach(entry => {
      expect(counts.get(entry.id)).toEqual({ home: 4, away: 4 });
    });
  });

  it('reverses an odd-slate preference in the next season when feasible', () => {
    const teamA = team(1);
    const teamB = team(2);
    const matchups = [matchup(teamA, teamB)];

    const first = orientConferenceMatchups({
      matchups,
      fixedGames: [],
      year: 2025,
      seed: 200,
    });
    const second = orientConferenceMatchups({
      matchups,
      fixedGames: [],
      year: 2026,
      seed: 200,
    });

    expect(first[0].homeTeam?.id).toBe(teamA.id);
    expect(second[0].homeTeam?.id).toBe(teamB.id);
  });

  it('keeps fixed sites and chooses the closest feasible remaining split', () => {
    const teams = Array.from({ length: 5 }, (_, index) => team(index + 1));
    const fixed = [
      fixedGame(teams[0], teams[1], teams[0], teams[1]),
      fixedGame(teams[0], teams[2], teams[0], teams[2]),
      fixedGame(teams[0], teams[3], teams[0], teams[3]),
    ];
    const fixedSnapshot = signature(fixed);

    const generated = orientConferenceMatchups({
      matchups: [matchup(teams[0], teams[4])],
      fixedGames: fixed,
      year: 2025,
      seed: 300,
    });

    expect(generated[0]).toMatchObject({
      homeTeam: { id: teams[4].id },
      awayTeam: { id: teams[0].id },
    });
    expect(signature(fixed)).toEqual(fixedSnapshot);
  });

  it('finds the global minimum conference imbalance', () => {
    const teams = Array.from({ length: 5 }, (_, index) => team(index + 1));
    const balancedTeams = teams.slice(0, 4);
    const matchups = balancedTeams.flatMap((teamA, index) =>
      balancedTeams.slice(index + 1).map(teamB => matchup(teamA, teamB))
    );
    const fixed = [
      fixedGame(teams[0], teams[4], teams[0], teams[4]),
      fixedGame(teams[1], teams[4], teams[1], teams[4]),
      fixedGame(teams[2], teams[4], teams[4], teams[2]),
    ];

    const generated = orientConferenceMatchups({
      matchups,
      fixedGames: fixed,
      year: 2025,
      seed: 350,
    });
    let optimalCost = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 2 ** matchups.length; mask += 1) {
      const candidate = matchups.map((game, index): FullGame => {
        const homeTeam = mask & (1 << index) ? game.teamA : game.teamB;
        return {
          ...game,
          weekPlayed: 0,
          homeTeam,
          awayTeam: homeTeam.id === game.teamA.id ? game.teamB : game.teamA,
          venue: null,
          name: null,
          rivalryKey: null,
        };
      });
      optimalCost = Math.min(
        optimalCost,
        squaredImbalance(balancedTeams, [...fixed, ...candidate]),
      );
    }

    expect(squaredImbalance(balancedTeams, [...fixed, ...generated])).toBe(optimalCost);
  });

  it('excludes neutral and non-conference fixed games from the objective', () => {
    const teamA = team(1);
    const teamB = team(2);
    const neutralOpponent = team(3);
    const otherConference = team(4, 'Other');
    const fixed = [
      fixedGame(teamA, neutralOpponent, null, null),
      fixedGame(teamA, otherConference, teamA, otherConference),
    ];

    const [generated] = orientConferenceMatchups({
      matchups: [matchup(teamA, teamB)],
      fixedGames: fixed,
      year: 2026,
      seed: 400,
    });

    expect(generated).toMatchObject({
      homeTeam: { id: teamB.id },
      awayTeam: { id: teamA.id },
    });
  });

  it('is deterministic without mutating its inputs', () => {
    const teams = Array.from({ length: 5 }, (_, index) => team(index + 1));
    const matchups = teams.flatMap((teamA, index) =>
      teams.slice(index + 1).map(teamB => matchup(teamA, teamB))
    );
    const inputSnapshot = matchups.map(game => [game.teamA.id, game.teamB.id]);

    const first = orientConferenceMatchups({
      matchups,
      fixedGames: [],
      year: 2025,
      seed: 500,
    });
    const repeated = orientConferenceMatchups({
      matchups,
      fixedGames: [],
      year: 2025,
      seed: 500,
    });

    expect(signature(repeated)).toEqual(signature(first));
    expect(matchups.map(game => [game.teamA.id, game.teamB.id])).toEqual(inputSnapshot);
  });
});
