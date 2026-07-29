import {
  HistoricalDataError,
} from '../../../types/league';
import { resolveHistoricalData } from '../historicalData';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildNextSeasonPreview } from '../nextSeasonPreview';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export const loadRealignment = async () => {
  const league = await loadLeagueOrThrow();
  const envelope = buildLeagueNavigationEnvelope(league);

  if (league.info.stage !== 'realignment') {
    return {
      ...envelope,
      configuration: null,
      preview: null,
      previewError: null,
    };
  }

  let preview = null;
  let previewError: string | null = null;

  try {
    const resolved = await resolveHistoricalData(
      league.info.currentYear + 1,
      league.info.startYear,
    );
    preview = buildNextSeasonPreview(league, resolved);
  } catch (error) {
    if (error instanceof HistoricalDataError) {
      previewError = error.message;
    } else {
      throw error;
    }
  }

  return {
    ...envelope,
    configuration: league.settings,
    preview,
    previewError,
  };
};
