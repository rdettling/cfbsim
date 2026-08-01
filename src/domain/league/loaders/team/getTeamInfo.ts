import type { Team } from '../../../../types/domain';
import { loadLeagueOptional } from '../../leagueStore';

export const getTeamInfo = async (teamName: string): Promise<Team | null> => {
  const league = await loadLeagueOptional();
  if (!league) return null;
  return league.teams.find(team => team.name === teamName) ?? null;
};
