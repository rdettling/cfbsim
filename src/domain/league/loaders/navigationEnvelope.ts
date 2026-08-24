import type { LeagueState } from '../../../types/league';
import type { LeagueNavigationData } from '../../../types/navigation';

export const buildLeagueNavigationEnvelope = (
  league: LeagueState,
): LeagueNavigationData => ({
  info: league.info,
  team:
    league.teams.find(team => team.name === league.info.team) ??
    league.teams[0],
  conferences: league.conferences,
  playoffTeams: league.settings.playoffTeams,
});
