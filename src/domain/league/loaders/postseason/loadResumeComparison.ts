import { getGameDetailsByYear } from '../../../../db/simRepo';
import { loadLeagueOrThrow } from '../../leagueStore';
import { buildResumeComparisonTeams } from '../../utils/resumeComparison';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';
import { loadPostseasonContext } from './context';

export const loadResumeComparison = async () => {
  const league = await loadLeagueOrThrow();
  const snapshot = league.resumeSnapshot;

  if (snapshot) {
    return {
      ...buildLeagueNavigationEnvelope(league),
      format: snapshot.playoff.teams,
      isProjection: false,
      teams: snapshot.teams,
    };
  }

  const context = await loadPostseasonContext(league);
  const details = await getGameDetailsByYear(league.info.currentYear);
  const resumeTeams = buildResumeComparisonTeams({
    league,
    games: context.games,
    details,
    selection: context.selection,
    championIds: new Set(context.champions.map(team => team.id)),
  });

  return {
    ...context.navigation,
    format: context.format,
    isProjection: context.isProjection,
    teams: resumeTeams,
  };
};
