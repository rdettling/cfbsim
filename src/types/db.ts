export interface GameRecord {
  id: number;
  teamAId: number;
  teamBId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  neutralSite: boolean;
  venue: string | null;
  winnerId: number | null;
  baseLabel: string;
  name: string | null;
  gameType: import('./news').GameType;
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
  resultA: 'W' | 'L' | null;
  resultB: 'W' | 'L' | null;
  overtime: number;
  quarter: number;
  clockSecondsLeft: number;
  scoreA: number | null;
  scoreB: number | null;
  watchability: number;
}

export type PlayType = 'run' | 'pass' | 'field goal' | 'punt' | 'extra point';

export type PlayResult =
  | 'run'
  | 'pass'
  | 'sack'
  | 'interception'
  | 'incomplete pass'
  | 'fumble'
  | 'touchdown'
  | 'made field goal'
  | 'missed field goal'
  | 'punt'
  | 'spike'
  | 'kneel'
  | 'made extra point'
  | 'missed extra point'
  | 'made two point run'
  | 'made two point pass'
  | 'failed two point run'
  | 'failed two point pass'
  | 'failed two point incomplete'
  | 'failed two point sack'
  | 'failed two point interception'
  | 'failed two point fumble';

export type DriveResult =
  | 'touchdown'
  | 'interception'
  | 'fumble'
  | 'safety'
  | 'turnover on downs'
  | 'made field goal'
  | 'missed field goal'
  | 'punt'
  | 'end of half'
  | 'end of game'
  | Extract<PlayResult, `${'made' | 'failed'} two point ${string}`>;

export interface DriveRecord {
  id: number;
  gameId: number;
  driveNum: number;
  offenseId: number;
  defenseId: number;
  startingFP: number;
  result: DriveResult | '';
  points: number;
  scoreAAfter: number;
  scoreBAfter: number;
}

export interface PlayParticipants {
  passerId: number | null;
  rusherId: number | null;
  targetId: number | null;
  tacklerId: number | null;
  sackerId: number | null;
  interceptorId: number | null;
  forcedFumbleById: number | null;
  fumbleRecoveryById: number | null;
  kickerId: number | null;
  punterId: number | null;
}

export type OffensiveConcept =
  | 'inside_run'
  | 'outside_run'
  | 'option'
  | 'quick_pass'
  | 'intermediate_pass'
  | 'deep_pass'
  | 'screen'
  | 'play_action';

export type DefensiveIntent =
  | 'base'
  | 'loaded_box'
  | 'coverage'
  | 'pressure';

export type ClockTempo = 'normal' | 'hurry_up' | 'chew_clock';

export type ClockManagementAction = 'spike' | 'kneel';

export type PlayCall =
  | {
      kind: 'scrimmage';
      offense: OffensiveConcept;
      defense: DefensiveIntent;
    }
  | { kind: 'clock_management'; action: ClockManagementAction }
  | { kind: 'special_teams'; concept: 'punt' | 'field_goal' }
  | { kind: 'try'; attempt: 'extra_point' }
  | {
      kind: 'try';
      attempt: 'two_point';
      offense: OffensiveConcept;
      defense: DefensiveIntent;
    };

export type ClockQuarter = 1 | 2 | 3 | 4;

export interface ClockSnapshot {
  quarter: ClockQuarter;
  secondsLeft: number;
  running: boolean;
}

export type RegulationClockEvent =
  | 'two_minute_timeout'
  | 'end_of_quarter'
  | 'halftime'
  | 'end_of_regulation';

export type PlayTiming =
  | {
      kind: 'regulation';
      start: ClockSnapshot;
      end: ClockSnapshot;
      elapsedSeconds: number;
      outOfBounds: boolean;
      tempo: ClockTempo;
      eventAfter: RegulationClockEvent | null;
      chargedTimeoutAfter: 'offense' | 'defense' | null;
    }
  | {
      kind: 'overtime';
      period: number;
      outOfBounds: boolean;
    }
  | {
      kind: 'try';
      context: 'regulation';
      quarter: ClockQuarter;
      secondsLeft: number;
    }
  | {
      kind: 'try';
      context: 'overtime';
      period: number;
    };

export interface PlayRecord {
  id: number;
  gameId: number;
  driveId: number;
  offenseId: number;
  defenseId: number;
  startingFP: number;
  down: number;
  yardsLeft: number;
  playType: PlayType;
  yardsGained: number;
  result: PlayResult | '';
  text: string;
  header: string;
  scoreA: number;
  scoreB: number;
  call: PlayCall;
  participants: PlayParticipants;
  timing: PlayTiming;
}

export interface GameLogRecord {
  playerId: number;
  gameId: number;
  pass_yards: number;
  pass_attempts: number;
  pass_completions: number;
  pass_touchdowns: number;
  pass_interceptions: number;
  rush_yards: number;
  rush_attempts: number;
  rush_touchdowns: number;
  receiving_yards: number;
  receiving_catches: number;
  receiving_touchdowns: number;
  fumbles: number;
  tackles: number;
  sacks: number;
  interceptions: number;
  fumbles_forced: number;
  fumbles_recovered: number;
  field_goals_made: number;
  field_goals_attempted: number;
  extra_points_made: number;
  extra_points_attempted: number;
}

export interface PlayerRecord {
  id: number;
  teamId: number;
  first: string;
  last: string;
  year: 'fr' | 'so' | 'jr' | 'sr';
  pos: string;
  rating: number;
  rating_fr: number;
  rating_so: number;
  rating_jr: number;
  rating_sr: number;
  stars: number;
  development_trait: number;
  starter: boolean;
}

export type PlayerSeasonStats = Omit<GameLogRecord, 'gameId'> & {
  year: number;
  teamId: number;
  position: string;
  classYear: PlayerRecord['year'];
  rating: number;
  starter: boolean;
  games: number;
};

export interface HistoricalPlayerRecord {
  id: number;
  first: string;
  last: string;
  pos: string;
  stars: number;
  development_trait: number;
}

interface PlayerOriginBase {
  playerId: number;
  acquisitionYear: number;
  originalTeamId: number;
}

export interface RecruitPlayerOrigin extends PlayerOriginBase {
  kind: 'recruit';
  homeState: string;
  nationalRank: number;
  positionRank: number;
  commitmentRound: 1 | 2 | 3 | 4 | 5 | 6 | 'signing_day';
  publicRatingMin: number;
  publicRatingMax: number;
}

export interface WalkOnPlayerOrigin extends PlayerOriginBase {
  kind: 'walk_on';
}

export interface InitialRosterPlayerOrigin extends PlayerOriginBase {
  kind: 'initial_roster';
  classAtStart: PlayerRecord['year'];
}

export interface ProgramEntryPlayerOrigin extends PlayerOriginBase {
  kind: 'program_entry';
  classAtEntry: PlayerRecord['year'];
}

export type PlayerOrigin =
  | RecruitPlayerOrigin
  | WalkOnPlayerOrigin
  | InitialRosterPlayerOrigin
  | ProgramEntryPlayerOrigin;

export type GameDetailPlay = Omit<
  PlayRecord,
  'id' | 'gameId' | 'driveId' | 'offenseId' | 'defenseId' | 'result'
> & { result: PlayResult };

export type GameDetailDrive = Omit<DriveRecord, 'id' | 'gameId' | 'result'> & {
  result: DriveResult;
  plays: GameDetailPlay[];
};

export interface GameDetailRecord {
  gameId: number;
  year: number;
  drives: GameDetailDrive[];
  playerStats: Array<Omit<GameLogRecord, 'gameId'>>;
}
