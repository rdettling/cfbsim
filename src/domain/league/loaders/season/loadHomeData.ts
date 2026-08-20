import { loadLeagueOptional } from '../../leagueStore';
import type { HomeData } from '../../../../types/league';

export const loadHomeData = async (): Promise<HomeData> => {
  const league = await loadLeagueOptional();
  if (!league) return { info: null, program: null };

  const team = league.teams.find(candidate => candidate.name === league.info.team);
  if (!team) {
    throw new Error(`The saved program ${league.info.team} is unavailable.`);
  }

  return {
    info: league.info,
    program: {
      name: team.name,
      record: team.record,
      ranking: team.ranking,
      conference: team.confName,
      rating: team.rating,
      colorPrimary: team.colorPrimary,
    },
  };
};
