import { getGamesByYear } from '../../../../db/simRepo';
import type { Team } from '../../../../types/domain';
import type { LeagueState } from '../../../../types/league';

export const getUserTeam = (league: LeagueState): Team =>
  league.teams.find(team => team.name === league.info.team) ?? league.teams[0];

export const getCurrentYearGames = (league: LeagueState) =>
  getGamesByYear(league.info.currentYear);
