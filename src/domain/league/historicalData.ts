import { getYearData, getYearsIndex } from '../../db/baseData';
import type { YearData } from '../../types/baseData';
import type {
  HistoricalDataResolution,
  PlayoffTeamCount,
} from '../../types/domain';
import { HistoricalDataError } from '../../types/league';

export interface ResolvedHistoricalData {
  dataSource: HistoricalDataResolution;
  yearData: YearData;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPlayoffTeamCount = (value: number): value is PlayoffTeamCount =>
  value === 2 || value === 4 || value === 12;

const validateYearData = (value: unknown, targetYear: number): YearData => {
  if (
    !isRecord(value) ||
    !isRecord(value.playoff) ||
    !isRecord(value.conferences)
  ) {
    throw new HistoricalDataError(
      targetYear,
      `Historical data for ${targetYear} is malformed.`,
    );
  }

  const playoffTeams = value.playoff.teams;
  if (typeof playoffTeams !== 'number' || !isPlayoffTeamCount(playoffTeams)) {
    throw new HistoricalDataError(
      targetYear,
      `Historical postseason data for ${targetYear} is malformed.`,
    );
  }
  const playoffAutobids = value.playoff.conf_champ_autobids;
  const playoffTopSeeds = value.playoff.conf_champ_top_4;
  if (
    (playoffAutobids !== undefined &&
      (typeof playoffAutobids !== 'number' ||
        !Number.isInteger(playoffAutobids) ||
        playoffAutobids < 0 ||
        playoffAutobids > 10)) ||
    (playoffTopSeeds !== undefined &&
      playoffTopSeeds !== null &&
      typeof playoffTopSeeds !== 'boolean')
  ) {
    throw new HistoricalDataError(
      targetYear,
      `Historical postseason data for ${targetYear} is malformed.`,
    );
  }

  for (const conference of Object.values(value.conferences)) {
    if (
      !isRecord(conference) ||
      typeof conference.games !== 'number' ||
      !Number.isFinite(conference.games) ||
      !isRecord(conference.teams) ||
      Object.values(conference.teams).some(
        prestige =>
          typeof prestige !== 'number' || !Number.isFinite(prestige),
      )
    ) {
      throw new HistoricalDataError(
        targetYear,
        `Historical conference data for ${targetYear} is malformed.`,
      );
    }
  }

  if (
    value.Independent !== undefined &&
    (!isRecord(value.Independent) ||
      Object.values(value.Independent).some(
        prestige =>
          typeof prestige !== 'number' || !Number.isFinite(prestige),
      ))
  ) {
    throw new HistoricalDataError(
      targetYear,
      `Historical independent-team data for ${targetYear} is malformed.`,
    );
  }

  return value as unknown as YearData;
};

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

  let rawYearData: unknown;
  try {
    rawYearData = await getYearData(String(sourceYear));
  } catch {
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
    yearData: validateYearData(rawYearData, sourceYear),
  };
};
