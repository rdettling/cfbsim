import type { LeagueState } from '../../../../types/league';

export const resolveTeam = (league: LeagueState, teamName?: string) =>
  (teamName ? league.teams.find(team => team.name === teamName) : undefined) ??
  league.teams.find(team => team.name === league.info.team) ??
  league.teams[0];

export const listTeamNames = (league: LeagueState) =>
  league.teams.map(team => team.name).sort((left, right) => left.localeCompare(right));
