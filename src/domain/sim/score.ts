import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';

export const getOffenseLead = (game: SimGame, offense: Team) =>
  offense.id === game.teamA.id
    ? game.scoreA - game.scoreB
    : game.scoreB - game.scoreA;
