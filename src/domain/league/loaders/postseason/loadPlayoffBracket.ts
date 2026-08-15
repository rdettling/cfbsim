import { buildBracket } from './buildBracket';
import { loadPostseasonContext } from './context';

export const loadPlayoffBracket = async () => {
  const context = await loadPostseasonContext();
  return {
    ...context.page,
    playoff_teams: context.playoff_teams,
    bracket: await buildBracket(
      context.league,
      context.playoffTeams,
      context.isProjection,
    ),
  };
};
