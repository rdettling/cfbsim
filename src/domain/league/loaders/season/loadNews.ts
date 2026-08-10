import { getNewsByYear } from '../../../../db/newsRepo';
import { sortNewsItems } from '../../../news/ordering';
import { loadLeagueOrThrow } from '../../leagueStore';
import { getUserTeam } from './shared';

export const loadNews = async (requestedYear?: number) => {
  const league = await loadLeagueOrThrow();
  const availableYears = Array.from(
    { length: league.info.currentYear - league.info.startYear + 1 },
    (_, index) => league.info.currentYear - index,
  );
  const year = requestedYear ?? league.info.currentYear;
  if (!availableYears.includes(year)) {
    throw new Error(`News is unavailable for the ${year} season.`);
  }
  const items = await getNewsByYear(year);
  const weeks = [...new Set(items.map(item => item.week))]
    .sort((left, right) => right - left)
    .map(week => ({
      week,
      stories: sortNewsItems(items.filter(item => item.week === week)),
    }));
  return {
    info: league.info,
    team: getUserTeam(league),
    conferences: league.conferences,
    year,
    availableYears,
    weeks,
  };
};
