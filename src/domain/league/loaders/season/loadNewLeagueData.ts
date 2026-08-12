import { getSeasonIndex } from '../../../../db/baseData';
import { buildPreviewData } from '../../../baseData';
import {
  NewLeagueConfigurationError,
  type NewLeagueData,
} from '../../../../types/league';

export const loadNewLeagueData = async (year?: string): Promise<NewLeagueData> => {
  const yearsIndex = await getSeasonIndex();
  const years = Array.isArray(yearsIndex.years)
    ? yearsIndex.years.filter(
        candidate => typeof candidate === 'string' && candidate.length > 0,
      )
    : [];
  const selectedYear = year || years[0] || null;
  if (year && !years.includes(year)) {
    throw new NewLeagueConfigurationError(`The ${year} season is not supported.`);
  }
  const preview = selectedYear ? await buildPreviewData(selectedYear) : null;

  return { years, preview, selectedYear };
};
