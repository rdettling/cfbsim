import type { Team } from './domain';

export interface FullGame {
  teamA: Team;
  teamB: Team;
  weekPlayed: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  venue: string | null;
  name?: string | null;
  rivalryKey: string | null;
}

export interface ScheduleConstraint {
  teamAId: number;
  teamBId: number;
  weekPlayed: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  name: string | null;
}
