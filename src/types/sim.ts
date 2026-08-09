import type { Team } from './domain';
import type { DriveRecord, PlayRecord, PlayerRecord } from './db';
import type { GameType } from './news';

export interface SimGame {
  id: number;
  teamA: Team;
  teamB: Team;
  homeTeam: Team | null;
  awayTeam: Team | null;
  neutralSite: boolean;
  venue: string | null;
  winner: Team | null;
  baseLabel: string;
  name: string | null;
  gameType: GameType;
  rivalryKey: string | null;
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
  playCount: number;
}

export interface InteractiveStepResult {
  state: InteractiveDriveState;
  play: PlayRecord;
  driveComplete: boolean;
  nextFieldPosition: number | null;
  gameComplete: boolean;
}
