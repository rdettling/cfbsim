import type { PlayerRecord } from '../types/db';
import type { PlayerProgressionProjection } from '../types/roster';

export {
  prepareInitialRosters,
} from './rosterBootstrap';
export { recalculateTeamRatings, setStarters } from './rosterRatings';

export const projectPlayerProgression = (
  player: PlayerRecord,
): PlayerProgressionProjection | null => {
  if (player.year === 'sr') return { status: 'departing' };
  if (player.year === 'fr') {
    return {
      status: 'returning',
      projectedClass: 'so',
      projectedRating: player.rating_so,
    };
  }
  if (player.year === 'so') {
    return {
      status: 'returning',
      projectedClass: 'jr',
      projectedRating: player.rating_jr,
    };
  }
  return {
    status: 'returning',
    projectedClass: 'sr',
    projectedRating: player.rating_sr,
  };
};

export const applyProgression = (players: PlayerRecord[]) => {
  for (let index = players.length - 1; index >= 0; index -= 1) {
    const player = players[index];
    const projection = projectPlayerProgression(player);
    if (!projection) continue;
    if (projection.status === 'departing') {
      players.splice(index, 1);
      continue;
    }

    player.year = projection.projectedClass;
    player.rating = projection.projectedRating;
  }
};
