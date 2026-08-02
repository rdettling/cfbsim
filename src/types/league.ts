import type {
  Conference,
  Info,
  LeagueStage,
  OffseasonStage,
  Team,
  PreviewData,
  ScheduleGame,
  PlayoffTeamCount,
  NextSeasonConfiguration,
  NewLeagueConferenceSetup,
  RivalryPlanWarning,
  PendingRivalry,
} from './domain';

export interface HomeProgramSummary {
  name: string;
  record: string;
  ranking: number;
  conference: string;
  rating: number;
  colorPrimary: string;
}

export type HomeData =
  | {
      info: null;
      program: null;
    }
  | {
      info: Info;
      program: HomeProgramSummary;
    };

export interface NewLeagueData {
  years: string[];
  preview: PreviewData | null;
  selectedYear: string | null;
}

export interface StartNewLeagueInput {
  teamName: string;
  year: string;
  conferenceSetup: NewLeagueConferenceSetup;
  playoff: {
    teams: PlayoffTeamCount;
    autobids?: number;
    conferenceChampionsReceiveTopSeeds?: boolean;
  };
}

export interface NonConData {
  info: Info;
  team: Team;
  schedule: ScheduleGame[];
  pending_rivalries: PendingRivalry[];
  rivalryWarnings: RivalryPlanWarning[];
  conferences: Conference[];
}

export interface PlayoffState {
  seeds: number[];
  left_r1_1?: number;
  left_r1_2?: number;
  right_r1_1?: number;
  right_r1_2?: number;
  left_quarter_1?: number;
  left_quarter_2?: number;
  right_quarter_1?: number;
  right_quarter_2?: number;
  left_semi?: number;
  right_semi?: number;
  natty?: number;
}

export interface ResumeSnapshotResult {
  opponentId: number;
  opponent: string;
  opponentRanking: number;
}

export interface ResumeSnapshotTeam {
  teamId: number;
  name: string;
  ranking: number;
  conference: string;
  record: string;
  pollScore: number;
  sorRank: number;
  sosRank: number | null;
  top25Record: string;
  bestWin: ResumeSnapshotResult | null;
  worstLoss: ResumeSnapshotResult | null;
  seed: number | null;
  isAutobid: boolean;
  hasBye: boolean;
  isChampion: boolean;
}

export interface ResumeComparisonSnapshot {
  year: number;
  frozenAfterWeek: number;
  playoff: {
    teams: PlayoffTeamCount;
    autobids: number;
    conferenceChampionsReceiveTopSeeds: boolean;
  };
  teams: ResumeSnapshotTeam[];
}

export interface LeagueState {
  info: Info;
  teams: Team[];
  conferences: Conference[];
  pending_rivalries: PendingRivalry[];
  declinedRivalries: string[];
  rivalryHostSeeds: Record<string, string>;
  scheduleBuilt: boolean;
  simInitialized: boolean;
  settings: NextSeasonConfiguration;
  playoff: PlayoffState;
  resumeSnapshot: ResumeComparisonSnapshot | null;
  idCounters: {
    game: number;
    player: number;
  };
}

export interface OffseasonAdvanceResult {
  previousStage: OffseasonAdvanceStage;
  currentStage: Exclude<LeagueStage, 'season' | 'summary'>;
  route: string;
}

export type OffseasonAdvanceStage = Exclude<
  OffseasonStage,
  'recruiting' | 'roster_cuts'
>;

export type LeagueDataIntegrityCode =
  | 'INVALID_LEAGUE_STATE'
  | 'INVALID_ROSTER_STATE';

export class LeagueDataIntegrityError extends Error {
  constructor(
    readonly code: LeagueDataIntegrityCode,
    message: string,
  ) {
    super(message);
    this.name = 'LeagueDataIntegrityError';
  }
}

export class OffseasonStageMismatchError extends Error {
  readonly expectedStage: OffseasonAdvanceStage;
  readonly actualStage: LeagueStage;

  constructor(expectedStage: OffseasonAdvanceStage, actualStage: LeagueStage) {
    super(
      `Cannot advance offseason from ${expectedStage}; the persisted league is at ${actualStage}.`,
    );
    this.name = 'OffseasonStageMismatchError';
    this.expectedStage = expectedStage;
    this.actualStage = actualStage;
  }
}

export class NextSeasonConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NextSeasonConfigurationError';
  }
}

export class NewLeagueConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewLeagueConfigurationError';
  }
}

export class HistoricalDataError extends Error {
  readonly targetYear: number;

  constructor(targetYear: number, message: string) {
    super(message);
    this.name = 'HistoricalDataError';
    this.targetYear = targetYear;
  }
}

export class OffseasonConfigurationConflictError extends Error {
  constructor() {
    super(
      'Next season settings changed while advancement was preparing. Review the refreshed setup and try again.',
    );
    this.name = 'OffseasonConfigurationConflictError';
  }
}

export const DEFAULT_NEXT_SEASON_CONFIGURATION: NextSeasonConfiguration = {
  conferencePolicy: 'historical',
  postseasonPolicy: 'historical',
  playoffTeams: 12,
  playoffAutobids: 6,
  conferenceChampionsReceiveTopSeeds: true,
};
