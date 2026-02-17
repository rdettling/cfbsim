import type { Team } from './domain';
import type { DriveRecord, PlayRecord, PlayerRecord } from './db';

export interface SimGame {
  id: number;
  teamA: Team;
  teamB: Team;
  homeTeam: Team | null;
  awayTeam: Team | null;
  neutralSite: boolean;
  winner: Team | null;
  baseLabel: string;
  name: string | null;
  spreadA: string;
  spreadB: string;
  moneylineA: string;
  moneylineB: string;
  winProbA: number;
  winProbB: number;
  weekPlayed: number;
  year: number;
  rankATOG: number;
  rankBTOG: number;
  resultA: string | null;
  resultB: string | null;
  overtime: number;
  quarter: number;
  clockSecondsLeft: number;
  clockRunning: boolean;
  scoreA: number;
  scoreB: number;
  headline: string | null;
  headline_subtitle?: string | null;
  headline_tags?: string[] | null;
  headline_tone?: string | null;
  watchability: number | null;
}

export interface SimDrive {
  record: DriveRecord;
  plays: PlayRecord[];
  nextFieldPosition: number;
}

export interface StartersCache {
  byTeamPos: Map<string, PlayerRecord[]>;
}

export type InteractivePlayChoice = 'run' | 'pass' | 'punt' | 'field_goal' | 'auto';

export interface InteractiveDriveState {
  drive: DriveRecord;
  fieldPosition: number;
  down: number;
  yardsLeft: number;
}

export interface InteractiveStepResult {
  state: InteractiveDriveState;
  play: PlayRecord;
  driveComplete: boolean;
  nextFieldPosition: number | null;
  gameComplete: boolean;
}
