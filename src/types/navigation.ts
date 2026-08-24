import type { Conference, Info, PlayoffTeamCount, Team } from './domain';

export interface LeagueNavigationData {
  team: Team;
  info: Info;
  conferences: Conference[];
  playoffTeams: PlayoffTeamCount;
}
