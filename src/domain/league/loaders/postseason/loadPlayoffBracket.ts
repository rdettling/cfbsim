import { loadOddsContext } from '../../../odds';
import { buildBracket } from './buildBracket';
import { loadPostseasonContext } from './context';

export const loadPlayoffBracket = async () => {
  const context = await loadPostseasonContext();
  const oddsContext = await loadOddsContext();
  return {
    ...context.navigation,
    format: context.format,
    autobids: context.league.settings.playoffAutobids,
    conferenceChampionsReceiveTopSeeds:
      context.league.settings.conferenceChampionsReceiveTopSeeds,
    isProjection: context.isProjection,
    hasTeams: context.playoffTeams.length > 0,
    bracket: await buildBracket(
      context.league,
      context.playoffTeams,
      context.isProjection,
      oddsContext,
    ),
  };
};
