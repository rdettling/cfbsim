import type { Team } from '../../types/domain';
import type { FullGame, UnorientedMatchup } from '../../types/scheduleTypes';
import { isConferenceGame } from './matchups';
import { assignMatchupHosts } from './siteAssignment';

type TeamSiteState = {
  team: Team;
  fixedHome: number;
  fixedAway: number;
  openGames: number;
};

const buildMarginalHomeCosts = (
  matchups: readonly UnorientedMatchup[],
  fixedGames: readonly FullGame[],
  year: number,
) => {
  const states = new Map<number, TeamSiteState>();
  const register = (team: Team) => {
    const existing = states.get(team.id);
    if (existing) return existing;
    const created: TeamSiteState = {
      team,
      fixedHome: 0,
      fixedAway: 0,
      openGames: 0,
    };
    states.set(team.id, created);
    return created;
  };

  matchups.forEach(matchup => {
    register(matchup.teamA).openGames += 1;
    register(matchup.teamB).openGames += 1;
  });
  fixedGames.forEach(game => {
    if (
      !isConferenceGame(game.teamA, game.teamB) ||
      !game.homeTeam ||
      !game.awayTeam
    ) return;
    const home = states.get(game.homeTeam.id);
    const away = states.get(game.awayTeam.id);
    if (home) home.fixedHome += 1;
    if (away) away.fixedAway += 1;
  });

  // One balance point must outweigh every team's annual rotation preference.
  const balanceWeight = states.size + 1;
  return new Map(Array.from(states.values()).map(state => {
    const conferenceGames = state.fixedHome + state.fixedAway + state.openGames;
    const preferredHome = (state.team.id + year) % 2 === 0
      ? Math.ceil(conferenceGames / 2)
      : Math.floor(conferenceGames / 2);
    const penalty = (additionalHome: number) => {
      const home = state.fixedHome + additionalHome;
      const away = conferenceGames - home;
      const rotationPenalty = conferenceGames % 2 === 1 && home !== preferredHome
        ? 1
        : 0;
      return balanceWeight * (home - away) ** 2 + rotationPenalty;
    };
    const marginalCosts = Array.from(
      { length: state.openGames },
      (_, index) => penalty(index + 1) - penalty(index),
    );
    return [state.team.id, marginalCosts] as const;
  }));
};

export const orientConferenceMatchups = ({
  matchups,
  fixedGames,
  year,
  seed,
}: {
  matchups: readonly UnorientedMatchup[];
  fixedGames: readonly FullGame[];
  year: number;
  seed: number;
}): FullGame[] => {
  const homeTeams = assignMatchupHosts({
    matchups,
    marginalHomeCosts: buildMarginalHomeCosts(matchups, fixedGames, year),
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
