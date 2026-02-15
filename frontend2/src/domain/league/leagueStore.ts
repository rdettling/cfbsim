import type { LeagueState } from '../../types/league';
import { loadLeague, saveLeague } from '../../db/leagueRepo';
import { normalizeLeague } from './normalize';

export const loadLeagueOrThrow = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  const changed = normalizeLeague(league);
  if (changed) await saveLeague(league);
  return league;
};

export const loadLeagueOptional = async () => {
  const league = await loadLeague<LeagueState>();
  if (!league) return null;
  const changed = normalizeLeague(league);
  if (changed) await saveLeague(league);
  return league;
};
