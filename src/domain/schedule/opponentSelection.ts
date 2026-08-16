import type { Team } from '../../types/domain';
import type { FullGame, UnorientedMatchup } from '../../types/scheduleTypes';
import { REGULAR_SEASON_GAMES } from './constants';
import { stableNumber } from './determinism';
import { registerMatchup, resetTeamScheduleCounts } from './matchups';

export type OpponentSelection = {
  fixedGames: FullGame[];
  conferenceMatchups: UnorientedMatchup[];
  automaticNonConferenceMatchups: UnorientedMatchup[];
  incompleteTeam: Team | null;
};

export const selectScheduleOpponents = ({
  teams,
  fixedGames,
  year,
  seed,
  attempt,
}: {
  teams: Team[];
  fixedGames: readonly FullGame[];
  year: number;
  seed: number;
  attempt: number;
}): OpponentSelection => {
  resetTeamScheduleCounts(teams);
  const scheduledOpponents = new Map<number, Set<number>>(
    teams.map(team => [team.id, new Set<number>()]),
  );
  fixedGames.forEach(game => {
    registerMatchup(game.teamA, game.teamB);
    scheduledOpponents.get(game.teamA.id)?.add(game.teamB.id);
    scheduledOpponents.get(game.teamB.id)?.add(game.teamA.id);
  });

  const conferenceMatchups: UnorientedMatchup[] = [];
  const conferences = Array.from(new Set(teams.map(team => team.conference))).filter(
    (conference): conference is string =>
      Boolean(conference) && conference !== 'Independent',
  );

  conferences.forEach(conference => {
    const members = teams.filter(team => team.conference === conference);
    const target = members.reduce(
      (maximum, team) => Math.max(maximum, team.confLimit),
      0,
    );
    members.forEach(team => {
      team.confLimit = target;
      team.nonConfLimit = REGULAR_SEASON_GAMES - target;
    });
    if ((members.length * target) % 2 === 1) {
      const rotation = members
        .slice()
        .sort((left, right) =>
          stableNumber(left.id, year, attempt) -
          stableNumber(right.id, year, attempt),
        )
        .find(team => team.confGames <= target - 1);
      if (rotation) {
        rotation.confLimit = target - 1;
        rotation.nonConfLimit = REGULAR_SEASON_GAMES - rotation.confLimit;
      }
    }
    let remainingTeams = members.slice();

    const getPotential = (team: Team) =>
      members.filter(opponent => {
        if (opponent.id === team.id) return false;
        if (opponent.confGames >= opponent.confLimit) return false;
        return !scheduledOpponents.get(team.id)?.has(opponent.id);
      });
    const getBuffer = (team: Team, potential: Team[]) =>
      potential.length - (team.confLimit - team.confGames);

    while (remainingTeams.length) {
      const stats = remainingTeams.map(team => {
        const potential = getPotential(team);
        return { team, potential, buffer: getBuffer(team, potential) };
      });
      stats.sort(
        (left, right) =>
          left.buffer - right.buffer ||
          left.team.confGames - right.team.confGames ||
          stableNumber(left.team.id, year, seed, attempt) -
          stableNumber(right.team.id, year, seed, attempt),
      );
      const { team, potential } = stats[0];
      remainingTeams = remainingTeams.filter(entry => entry.id !== team.id);

      const potentialBuffers = new Map(
        potential.map(opponent => [
          opponent.id,
          getBuffer(opponent, getPotential(opponent)),
        ]),
      );
      const sortedPotential = potential.slice().sort((left, right) =>
        (potentialBuffers.get(left.id) ?? 0) -
          (potentialBuffers.get(right.id) ?? 0) ||
        left.confGames - right.confGames ||
        stableNumber(left.id, team.id, year, seed, attempt) -
          stableNumber(right.id, team.id, year, seed, attempt)
      );

      while (team.confGames < team.confLimit) {
        const opponent = sortedPotential.shift();
        if (!opponent) break;
        if (opponent.confGames >= opponent.confLimit) continue;
        if (scheduledOpponents.get(team.id)?.has(opponent.id)) continue;

        conferenceMatchups.push({ teamA: team, teamB: opponent });
        registerMatchup(team, opponent);
        scheduledOpponents.get(team.id)?.add(opponent.id);
        scheduledOpponents.get(opponent.id)?.add(team.id);
      }
    }
  });

  const automaticNonConferenceMatchups: UnorientedMatchup[] = [];
  let remainingTeams = teams.slice();
  const getPotential = (team: Team) =>
    teams.filter(opponent => {
      if (opponent.id === team.id) return false;
      if (opponent.nonConfGames >= opponent.nonConfLimit) return false;
      if (scheduledOpponents.get(team.id)?.has(opponent.id)) return false;
      if (opponent.conference !== team.conference) return true;
      return team.conference === 'Independent' &&
        opponent.conference === 'Independent';
    });
  const getBuffer = (team: Team, potential: Team[]) =>
    potential.length - (team.nonConfLimit - team.nonConfGames);

  while (remainingTeams.length) {
    const stats = remainingTeams.map(team => {
      const potential = getPotential(team);
      return { team, potential, buffer: getBuffer(team, potential) };
    });
    stats.sort(
      (left, right) =>
        left.buffer - right.buffer ||
        left.team.nonConfGames - right.team.nonConfGames ||
        stableNumber(left.team.id, year, seed, 1, attempt) -
        stableNumber(right.team.id, year, seed, 1, attempt),
    );
    const { team, potential } = stats[0];
    remainingTeams = remainingTeams.filter(entry => entry.id !== team.id);

    const potentialBuffers = new Map(
      potential.map(opponent => [
        opponent.id,
        getBuffer(opponent, getPotential(opponent)),
      ]),
    );
    const sortedPotential = potential.slice().sort((left, right) =>
      (potentialBuffers.get(left.id) ?? 0) -
        (potentialBuffers.get(right.id) ?? 0) ||
      left.nonConfGames - right.nonConfGames ||
      stableNumber(left.id, team.id, year, seed, 1, attempt) -
        stableNumber(right.id, team.id, year, seed, 1, attempt)
    );

    while (team.nonConfGames < team.nonConfLimit) {
      const opponent = sortedPotential.shift();
      if (!opponent) break;
      if (opponent.nonConfGames >= opponent.nonConfLimit) continue;
      if (scheduledOpponents.get(team.id)?.has(opponent.id)) continue;

      automaticNonConferenceMatchups.push({ teamA: team, teamB: opponent });
      registerMatchup(team, opponent);
      scheduledOpponents.get(team.id)?.add(opponent.id);
      scheduledOpponents.get(opponent.id)?.add(team.id);
    }
  }

  return {
    fixedGames: fixedGames.map(game => ({ ...game })),
    conferenceMatchups,
    automaticNonConferenceMatchups,
    incompleteTeam: teams.find(
      team => team.confGames + team.nonConfGames !== REGULAR_SEASON_GAMES,
    ) ?? null,
  };
};
