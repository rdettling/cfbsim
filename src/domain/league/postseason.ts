import type { PlayoffTeamCount } from '../../types/domain';
import { REGULAR_SEASON_WEEKS } from '../schedule/constants';

export const CONFERENCE_CHAMPIONSHIP_WEEK = REGULAR_SEASON_WEEKS + 1;
export const BOWL_WEEK = CONFERENCE_CHAMPIONSHIP_WEEK + 1;

export const LAST_WEEK_BY_PLAYOFF_TEAMS: Record<number, number> = {
  2: BOWL_WEEK,
  4: CONFERENCE_CHAMPIONSHIP_WEEK + 2,
  12: CONFERENCE_CHAMPIONSHIP_WEEK + 4,
};

export const getLastWeekByPlayoffTeams = (playoffTeams: PlayoffTeamCount) =>
  LAST_WEEK_BY_PLAYOFF_TEAMS[playoffTeams];
