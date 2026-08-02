import { loadLeagueOrThrow } from '../leagueStore';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

const loadRoadmapPage = async () => {
  const league = await loadLeagueOrThrow();
  return buildLeagueNavigationEnvelope(league);
};

export const loadAdvancedStats = loadRoadmapPage;
export const loadPostseasonProjections = loadRoadmapPage;
