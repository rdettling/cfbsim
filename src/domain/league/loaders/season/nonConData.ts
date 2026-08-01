import type {
  RivalryResolution,
  ScheduleGame,
} from '../../../../types/domain';
import type { LeagueState, NonConData } from '../../../../types/league';
import { rivalryKey } from '../../../rivalryScheduling';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';

export const buildNonConData = (
  league: LeagueState,
  schedule: ScheduleGame[],
  rivalryResolution: RivalryResolution,
): NonConData => {
  const omittedKeys = new Set(
    rivalryResolution.omitted.map(warning =>
      rivalryKey(warning.teamA, warning.teamB),
    ),
  );
  const declinedKeys = new Set(league.declinedRivalries);

  return {
    ...buildLeagueNavigationEnvelope(league),
    schedule,
    pending_rivalries: league.pending_rivalries.filter(rivalry => {
      const key = rivalryKey(rivalry.teamA, rivalry.teamB);
      return !declinedKeys.has(key) && !omittedKeys.has(key);
    }),
    rivalryWarnings: rivalryResolution.omitted.filter(
      warning =>
        warning.teamA === league.info.team ||
        warning.teamB === league.info.team,
    ),
  };
};
