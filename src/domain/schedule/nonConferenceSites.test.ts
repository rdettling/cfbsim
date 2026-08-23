import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { Team } from '../../types/domain';
import type { FullGame, UnorientedMatchup } from '../../types/scheduleTypes';
import { orientAutomaticNonConferenceMatchups } from './nonConferenceSites';

const team = (id: number): Team => buildTestTeam({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit: 8,
  nonConfGames: 0,
  nonConfLimit: 4,
  ranking: 0,
  offense: 75,
  defense: 75,
  conference: `Conference ${id}`,
  confName: `Conference ${id}`,
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

const game = (
  teamA: Team,
  teamB: Team,
  homeTeam: Team | null,
  awayTeam: Team | null,
  name = 'Locked game',
): FullGame => ({
  teamA,
  teamB,
  weekPlayed: 1,
  homeTeam,
  awayTeam,
  venue: homeTeam ? null : 'Neutral Stadium',
  name,
  rivalryKey: `${teamA.id}:${teamB.id}`,
});

const lockedHomeGames = (entry: Team, count: number, firstOpponentId: number) =>
  Array.from({ length: count }, (_, index) => {
    const opponent = team(firstOpponentId + index);
    return game(entry, opponent, entry, opponent);
  });

const homeCounts = (teams: Team[], games: readonly FullGame[]) => {
  const counts = new Map(teams.map(entry => [entry.id, 0]));
  games.forEach(entry => {
    if (entry.homeTeam && counts.has(entry.homeTeam.id)) {
      counts.set(entry.homeTeam.id, counts.get(entry.homeTeam.id)! + 1);
    }
  });
  return counts;
};

const squaredTargetPenalty = (teams: Team[], games: readonly FullGame[]) => {
  const counts = homeCounts(teams, games);
  return teams.reduce(
    (total, entry) => total + (counts.get(entry.id)! - 6) ** 2,
    0,
  );
};

const signature = (games: readonly FullGame[]) => games.map(entry => [
  entry.teamA.id,
  entry.teamB.id,
  entry.homeTeam?.id ?? null,
  entry.awayTeam?.id ?? null,
]);

describe('automatic non-conference site orientation', () => {
  it('gives every team six total home games when the matchup graph allows it', () => {
    const teams = Array.from({ length: 4 }, (_, index) => team(index + 1));
    const locked = teams.flatMap((entry, index) =>
      lockedHomeGames(entry, 5, 100 + index * 10)
    );
    const matchups = [
      matchup(teams[0], teams[1]),
      matchup(teams[1], teams[2]),
      matchup(teams[2], teams[3]),
      matchup(teams[3], teams[0]),
    ];

    const generated = orientAutomaticNonConferenceMatchups({
      matchups,
      lockedGames: locked,
      year: 2025,
      seed: 100,
    });

    expect(Array.from(homeCounts(teams, [...locked, ...generated]).values()))
      .toEqual([6, 6, 6, 6]);
  });

  it('finds the global minimum distance from six home games', () => {
    const teams = Array.from({ length: 4 }, (_, index) => team(index + 1));
    const lockedHomeByTeam = [3, 5, 6, 7];
    const locked = teams.flatMap((entry, index) =>
      lockedHomeGames(entry, lockedHomeByTeam[index], 200 + index * 10)
    );
    const matchups = [
      matchup(teams[0], teams[1]),
      matchup(teams[0], teams[2]),
      matchup(teams[0], teams[3]),
      matchup(teams[1], teams[2]),
      matchup(teams[2], teams[3]),
    ];

    const generated = orientAutomaticNonConferenceMatchups({
      matchups,
      lockedGames: locked,
      year: 2025,
      seed: 200,
    });
    let optimalPenalty = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 2 ** matchups.length; mask += 1) {
      const candidate = matchups.map((entry, index) => {
        const homeTeam = mask & (1 << index) ? entry.teamA : entry.teamB;
        const awayTeam = homeTeam.id === entry.teamA.id ? entry.teamB : entry.teamA;
        return game(entry.teamA, entry.teamB, homeTeam, awayTeam);
      });
      optimalPenalty = Math.min(
        optimalPenalty,
        squaredTargetPenalty(teams, [...locked, ...candidate]),
      );
    }

    expect(squaredTargetPenalty(teams, [...locked, ...generated]))
      .toBe(optimalPenalty);
  });

  it('counts locked hosts while ignoring away and neutral appearances', () => {
    const teamA = team(1);
    const teamB = team(2);
    const other = team(3);
    const locked = [
      ...lockedHomeGames(teamA, 5, 300),
      ...lockedHomeGames(teamB, 6, 400),
      game(teamA, other, other, teamA, 'Manual away game'),
      game(teamA, teamB, null, null, 'Neutral rivalry'),
    ];
    const snapshot = signature(locked);

    const [generated] = orientAutomaticNonConferenceMatchups({
      matchups: [matchup(teamA, teamB)],
      lockedGames: locked,
      year: 2025,
      seed: 300,
    });

    expect(generated).toMatchObject({
      homeTeam: { id: teamA.id },
      awayTeam: { id: teamB.id },
      venue: null,
      name: null,
      rivalryKey: null,
    });
    expect(signature(locked)).toEqual(snapshot);
  });

  it('returns the closest feasible orientation when locked sites exceed target', () => {
    const teamA = team(1);
    const teamB = team(2);
    const locked = [
      ...lockedHomeGames(teamA, 8, 500),
      ...lockedHomeGames(teamB, 7, 600),
    ];

    const [generated] = orientAutomaticNonConferenceMatchups({
      matchups: [matchup(teamA, teamB)],
      lockedGames: locked,
      year: 2025,
      seed: 400,
    });

    expect(generated.homeTeam?.id).toBe(teamB.id);
    expect(generated.awayTeam?.id).toBe(teamA.id);
  });

  it('is deterministic, preserves input order, and does not mutate inputs', () => {
    const teams = Array.from({ length: 4 }, (_, index) => team(index + 1));
    const matchups = [
      matchup(teams[2], teams[0]),
      matchup(teams[3], teams[1]),
      matchup(teams[0], teams[1]),
    ];
    const inputSnapshot = matchups.map(entry => [entry.teamA.id, entry.teamB.id]);

    const first = orientAutomaticNonConferenceMatchups({
      matchups,
      lockedGames: [],
      year: 2025,
      seed: 500,
    });
    const repeated = orientAutomaticNonConferenceMatchups({
      matchups,
      lockedGames: [],
      year: 2025,
      seed: 500,
    });

    expect(signature(repeated)).toEqual(signature(first));
    expect(first.map(entry => [entry.teamA.id, entry.teamB.id]))
      .toEqual(inputSnapshot);
    expect(matchups.map(entry => [entry.teamA.id, entry.teamB.id]))
      .toEqual(inputSnapshot);
  });
});
