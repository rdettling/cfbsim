import type { LeagueState } from '../../types/league';
import { ensureLeaguePostseasonState } from './postseason';

export const normalizeLeague = (league: LeagueState) => {
  let changed = false;
  if ('schedule' in league) {
    delete (league as Record<string, unknown>).schedule;
    changed = true;
  }
  if (ensureLeaguePostseasonState(league)) {
    changed = true;
  }
  return changed;
};
