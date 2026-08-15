import type { Team } from './domain';
import type { LeagueState } from './league';
import type {
  ClockManagementAction,
  ClockTempo,
  DefensiveIntent,
  DriveRecord,
  OffensiveConcept,
  PlayRecord,
  PlayerRecord,
} from './db';
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
  timeoutsRemainingA: number;
  timeoutsRemainingB: number;
  scoreA: number;
  scoreB: number;
  watchability: number | null;
}

export type ClockState = {
  quarter: number;
  secondsLeft: number;
  clockRunning: boolean;
};

export type PlaySituation = {
  down: number;
  yardsLeft: number;
  fieldPosition: number;
  offenseLead: number;
  clock: ClockState;
};

export interface SimDrive {
  record: DriveRecord;
  plays: PlayRecord[];
  nextFieldPosition: number;
}

export interface StartersCache {
  byTeamPos: Map<string, PlayerRecord[]>;
  byId: Map<number, PlayerRecord>;
}

export type SimContext = {
  league: LeagueState;
  game: SimGame;
  starters: StartersCache;
  offense: Team;
  defense: Team;
  clockEnabled: boolean;
  overtimePossession: 0 | 1 | null;
};

export type InteractivePlayInstruction =
  | { kind: 'offense'; concept: OffensiveConcept }
  | { kind: 'defense'; intent: DefensiveIntent }
  | { kind: 'clock_management'; action: ClockManagementAction }
  | { kind: 'special_teams'; concept: 'punt' | 'field_goal' }
  | { kind: 'try'; attempt: 'extra_point' }
  | { kind: 'try_offense'; concept: OffensiveConcept }
  | { kind: 'try_defense'; intent: DefensiveIntent };

export type InteractivePlayChoice = InteractivePlayInstruction | 'auto';

export type TimeoutInstruction = 'auto' | 'use' | 'hold';

export interface InteractiveStepInstruction {
  call: InteractivePlayChoice;
  tempo: ClockTempo | 'auto';
  timeoutAfter: {
    offense: TimeoutInstruction;
    defense: TimeoutInstruction;
  };
}

export interface InteractiveDriveState {
  drive: DriveRecord;
  phase: 'scrimmage' | 'try';
  tryOrigin: 'touchdown' | 'overtime_shootout' | null;
  tryTiming: Extract<import('./db').PlayTiming, { kind: 'try' }> | null;
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
