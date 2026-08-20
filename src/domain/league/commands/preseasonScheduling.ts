import type { LeagueState } from '../../../types/league';

export const requireEditablePreseason = (league: LeagueState) => {
  if (
    league.info.stage !== 'preseason' ||
    league.scheduleBuilt ||
    league.simInitialized
  ) {
    throw new Error('Preseason scheduling is no longer editable.');
  }
};
