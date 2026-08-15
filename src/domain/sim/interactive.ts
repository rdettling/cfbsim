import type { LeagueState } from '../../types/league';
import type { SimContext, SimGame, StartersCache } from '../../types/sim';
import type { PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';

export type InteractiveContextBase = {
  league: LeagueState;
  simGame: SimGame;
  starters: StartersCache;
  playersById: Map<number, PlayerRecord>;
  currentOffense: Team | null;
  currentDefense: Team | null;
  otPossession: number;
};

export const buildSimContext = (
  context: InteractiveContextBase,
  clockEnabled: boolean
): SimContext | null => {
  if (!context.currentOffense || !context.currentDefense) return null;
  return {
    league: context.league,
    game: context.simGame,
    starters: context.starters,
    offense: context.currentOffense,
    defense: context.currentDefense,
    clockEnabled,
    overtimePossession: clockEnabled ? null : context.otPossession as 0 | 1,
  };
};
