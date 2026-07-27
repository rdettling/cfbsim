import type { NonConData } from '../../../../types/league';
import { loadLeagueOrThrow } from '../../leagueStore';
import { getUserSchedule } from './shared';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';

export const loadNonCon = async (): Promise<NonConData> => {
  const league = await loadLeagueOrThrow();

  const envelope = buildLeagueNavigationEnvelope(league);
  if (league.info.stage !== 'preseason') {
    return {
      ...envelope,
      schedule: [],
      pending_rivalries: [],
    };
  }

  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  return {
    ...envelope,
    schedule,
    pending_rivalries: league.pending_rivalries,
  };
};
