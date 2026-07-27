import type {
  Conference,
  Info,
  LeagueStage,
  OffseasonStage,
  Team,
  Settings,
  PreviewData,
  ScheduleGame,
  PlayoffTeamCount,
} from './domain';

export interface LaunchProps {
  years: string[];
  info: Info | null;
  preview: PreviewData | null;
  selected_year: string | null;
}

export interface StartNewLeagueInput {
  teamName: string;
  year: string;
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
  pending_rivalries: Array<{
    id: number;
    teamA: string;
    teamB: string;
    name: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
  }>;
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

export interface LeagueState {
  info: Info;
  teams: Team[];
  conferences: Conference[];
  pending_rivalries: NonConData['pending_rivalries'];
  rivalryHostSeeds?: Record<string, string>;
  scheduleBuilt?: boolean;
  simInitialized?: boolean;
  settings?: Settings;
  playoff?: PlayoffState;
  idCounters?: {
    game: number;
    drive: number;
    play: number;
    gameLog: number;
    player: number;
  };
}

export interface OffseasonAdvanceResult {
  previousStage: OffseasonStage;
  currentStage: Exclude<LeagueStage, 'season' | 'summary'>;
  route: string;
}

export class OffseasonStageMismatchError extends Error {
  readonly expectedStage: OffseasonStage;
  readonly actualStage: LeagueStage;

  constructor(expectedStage: OffseasonStage, actualStage: LeagueStage) {
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

export const DEFAULT_SETTINGS: Settings = {
  playoff_teams: 12,
  playoff_autobids: 6,
  playoff_conf_champ_top_4: true,
  auto_realignment: true,
  auto_update_postseason_format: true,
};

export const ensureSettings = (league: LeagueState) => {
  if (!league.settings) {
    league.settings = { ...DEFAULT_SETTINGS };
    return true;
  }
  return false;
};
