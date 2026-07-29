import { loadLeague } from '../../db/leagueRepo';

export const loadLeagueOrThrow = async () => {
  const league = await loadLeague();
  if (!league) {
    throw new Error('No league found. Start a new game from the Home page.');
  }
  return league;
};

export const loadLeagueOptional = async () => {
  return loadLeague();
};
