import { getYearData, getYearsIndex } from '../../db/baseData';
import type { YearData } from '../../types/baseData';
import { YearDataValidationError } from '../yearDataValidation';
import type { HistoricalDataResolution } from '../../types/domain';
import { HistoricalDataError } from '../../types/league';

export interface ResolvedHistoricalData {
  dataSource: HistoricalDataResolution;
  yearData: YearData;
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
    index = await getYearsIndex();
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

  let yearData: YearData;
  try {
    yearData = await getYearData(String(sourceYear));
  } catch (error) {
    if (error instanceof YearDataValidationError) {
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
