import type { LeagueState } from '../../../types/league';

export const buildLeagueNavigationEnvelope = (
  league: LeagueState,
) => ({
  info: league.info,
  team:
    league.teams.find(team => team.name === league.info.team) ??
    league.teams[0],
  conferences: league.conferences,
});
