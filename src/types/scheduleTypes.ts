import type { Team } from './domain';

export interface TeamScheduleOpponent {
  name: string;
  rating: number | null;
  ranking: number;
  record: string | null;
  canOpen: boolean;
}

export interface TeamScheduleGameRow {
  kind: 'game';
  source: 'simulated' | 'historical';
  rowKey: string;
  weekPlayed: number;
  opponent: TeamScheduleOpponent;
  result: 'W' | 'L' | null;
  score: string | null;
  spread: string | null;
  moneyline: string | null;
  gameId: string | null;
  location: 'Home' | 'Away' | 'Neutral';
  venue: string | null;
  label: string;
}

export interface TeamScheduleByeRow {
  kind: 'bye';
  source: 'bye';
  rowKey: string;
  weekPlayed: number;
}

export type TeamScheduleRow = TeamScheduleGameRow | TeamScheduleByeRow;

export interface TeamScheduleHeaderMetrics {
  record: string;
  rating: number | null;
  prestige: number;
  ranking: number;
  conference: string;
}

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

export interface UnorientedMatchup {
  teamA: Team;
  teamB: Team;
}

export interface ScheduleConstraint {
  teamAId: number;
  teamBId: number;
  weekPlayed: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  name: string | null;
}
