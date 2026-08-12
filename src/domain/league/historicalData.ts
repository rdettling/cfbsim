import { getSeasonData, getSeasonIndex } from '../../db/baseData';
import type { SeasonData } from '../../types/baseData';
import { SeasonDataValidationError } from '../seasonDataValidation';
import type { HistoricalDataResolution } from '../../types/domain';
import { HistoricalDataError } from '../../types/league';

export interface ResolvedHistoricalData {
  dataSource: HistoricalDataResolution;
  yearData: SeasonData;
}

const selectClosestYear = (
  years: number[],
  targetYear: number,
  startYear?: number,
) => {
  const lowerBound = startYear ?? years[0];
  const candidates = years.filter(
    year => year <= targetYear && year >= lowerBound,
  );
  if (candidates.length) return candidates[candidates.length - 1];

  const earlier = years.filter(year => year <= targetYear);
  if (earlier.length) return earlier[earlier.length - 1];
  return years[0];
};

export const resolveHistoricalData = async (
  targetYear: number,
  startYear?: number,
): Promise<ResolvedHistoricalData> => {
  let index: { years: string[] };
  try {
    index = await getSeasonIndex();
  } catch {
    throw new HistoricalDataError(
      targetYear,
      `Historical year index could not be loaded for ${targetYear}.`,
    );
  }

  const years = Array.isArray(index?.years)
    ? index.years
        .map(year => Number(year))
        .filter(year => Number.isInteger(year))
        .sort((a, b) => a - b)
    : [];

  if (!years.length) {
    throw new HistoricalDataError(
      targetYear,
      'Historical year data is unavailable.',
    );
  }

  const sourceYear = years.includes(targetYear)
    ? targetYear
    : selectClosestYear(years, targetYear, startYear);

  let yearData: SeasonData;
  try {
    yearData = await getSeasonData(String(sourceYear));
  } catch (error) {
    if (error instanceof SeasonDataValidationError) {
      throw new HistoricalDataError(
        targetYear,
        `Historical data for ${sourceYear} is malformed.`,
      );
    }
    throw new HistoricalDataError(
      targetYear,
      `Historical data for ${sourceYear} could not be loaded.`,
    );
  }

  return {
    dataSource: {
      targetYear,
      sourceYear,
      resolution: sourceYear === targetYear ? 'exact' : 'fallback',
      atHistoricalFrontier: targetYear > years[years.length - 1],
    },
    yearData,
  };
};
