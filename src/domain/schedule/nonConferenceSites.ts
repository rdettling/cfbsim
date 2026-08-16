import type { Team } from '../../types/domain';
import type { FullGame, UnorientedMatchup } from '../../types/scheduleTypes';
import { assignMatchupHosts } from './siteAssignment';

const TARGET_HOME_GAMES = 6;

type TeamSiteState = {
  team: Team;
  lockedHome: number;
  openGames: number;
};

const buildMarginalHomeCosts = (
  matchups: readonly UnorientedMatchup[],
  lockedGames: readonly FullGame[],
) => {
  const states = new Map<number, TeamSiteState>();
  const register = (team: Team) => {
    const existing = states.get(team.id);
    if (existing) return existing;
    const created = { team, lockedHome: 0, openGames: 0 };
    states.set(team.id, created);
    return created;
  };

  matchups.forEach(matchup => {
    register(matchup.teamA).openGames += 1;
    register(matchup.teamB).openGames += 1;
  });
  lockedGames.forEach(game => {
    if (!game.homeTeam) return;
    const state = states.get(game.homeTeam.id);
    if (state) state.lockedHome += 1;
  });

  return new Map(Array.from(states.values()).map(state => {
    const penalty = (additionalHome: number) =>
      (state.lockedHome + additionalHome - TARGET_HOME_GAMES) ** 2;
    const marginalCosts = Array.from(
      { length: state.openGames },
      (_, index) => penalty(index + 1) - penalty(index),
    );
    return [state.team.id, marginalCosts] as const;
  }));
};

export const orientAutomaticNonConferenceMatchups = ({
  matchups,
  lockedGames,
  year,
  seed,
}: {
  matchups: readonly UnorientedMatchup[];
  lockedGames: readonly FullGame[];
  year: number;
  seed: number;
}): FullGame[] => {
  const homeTeams = assignMatchupHosts({
    matchups,
    marginalHomeCosts: buildMarginalHomeCosts(matchups, lockedGames),
    year,
    seed,
  });

  return matchups.map((matchup, index) => {
    const homeTeam = homeTeams[index];
    const awayTeam = homeTeam.id === matchup.teamA.id
      ? matchup.teamB
      : matchup.teamA;
    return {
      teamA: matchup.teamA,
      teamB: matchup.teamB,
      weekPlayed: 0,
      homeTeam,
      awayTeam,
      venue: null,
      name: null,
      rivalryKey: null,
    };
  });
};
