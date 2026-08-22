import { getStageRoute } from '../../../constants/stages';
import { loadLeagueOrThrow } from '../leagueStore';

export const loadCurrentStageRoute = async () => {
  const league = await loadLeagueOrThrow();
  return getStageRoute(league.info.stage);
};
