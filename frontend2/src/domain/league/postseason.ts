import type { LeagueState } from '../../types/league';
import { DEFAULT_SETTINGS } from '../../types/league';

export const REGULAR_SEASON_WEEKS = 14;
export const CONFERENCE_CHAMPIONSHIP_WEEK = REGULAR_SEASON_WEEKS + 1;

export const LAST_WEEK_BY_PLAYOFF_TEAMS: Record<number, number> = {
  2: CONFERENCE_CHAMPIONSHIP_WEEK + 1,
  4: CONFERENCE_CHAMPIONSHIP_WEEK + 2,
  12: CONFERENCE_CHAMPIONSHIP_WEEK + 4,
};

export const getLastWeekByPlayoffTeams = (playoffTeams: number) =>
  LAST_WEEK_BY_PLAYOFF_TEAMS[playoffTeams] ?? LAST_WEEK_BY_PLAYOFF_TEAMS[DEFAULT_SETTINGS.playoff_teams];

export const ensureLeaguePostseasonState = (league: LeagueState) => {
  let changed = false;

  if (!league.settings) {
    league.settings = { ...DEFAULT_SETTINGS };
    changed = true;
  }

  const lastWeek = getLastWeekByPlayoffTeams(league.settings.playoff_teams);
  if (league.info.lastWeek !== lastWeek) {
    league.info.lastWeek = lastWeek;
    changed = true;
  }

  if (!league.playoff) {
    league.playoff = { seeds: [] };
    changed = true;
  } else if (!league.playoff.seeds) {
    league.playoff.seeds = [];
    changed = true;
  }

  return changed;
};
