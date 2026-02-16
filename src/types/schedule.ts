import type { Team } from './domain';

export interface FullGame {
  teamA: Team;
  teamB: Team;
  weekPlayed: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  name?: string | null;
}
