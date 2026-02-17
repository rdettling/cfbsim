import type { LeagueState } from '../../types/league';
import type { SimGame, StartersCache } from '../../types/sim';
import type { PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { SimContext } from './engine';

export type InteractiveContextBase = {
  league: LeagueState;
  simGame: SimGame;
  starters: StartersCache;
  playersById: Map<number, PlayerRecord>;
  currentOffense: Team | null;
  currentDefense: Team | null;
};

export const buildSimContext = (
  context: InteractiveContextBase,
  clockEnabled: boolean
): SimContext | null => {
  if (!context.currentOffense || !context.currentDefense) return null;
  const isTeamAOnOffense = context.currentOffense.id === context.simGame.teamA.id;
  const lead = isTeamAOnOffense
    ? context.simGame.scoreA - context.simGame.scoreB
    : context.simGame.scoreB - context.simGame.scoreA;
  return {
    league: context.league,
    game: context.simGame,
    starters: context.starters,
    offense: context.currentOffense,
    defense: context.currentDefense,
    lead,
    clockEnabled,
  };
};
