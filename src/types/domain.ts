export type ConferenceTiebreaker =
  | 'head_to_head'
  | 'common_opponents'
  | 'overall_record'
  | 'poll_rank';

export interface ConferenceFinalStandingEntry {
  teamId: number;
  pollRank: number;
  resolvedBy: ConferenceTiebreaker | null;
}

export interface ConferenceFinalStandings {
  year: number;
  entries: ConferenceFinalStandingEntry[];
}

export interface Conference {
  id: number;
  confName: string;
  confFullName: string;
  confGames: number;
  info: string;
  championship: number | null;
  finalStandings: ConferenceFinalStandings | null;
  teams: Team[];
}

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  confGames: number;
  confLimit: number;
  nonConfGames: number;
  nonConfLimit: number;
  prestige: number;
  ceiling: number;
  floor: number;
  mascot: string;
  city: string;
  state: string;
  stadium: string;
  ranking: number;
  offense: number;
  defense: number;
  colorPrimary: string;
  colorSecondary: string;
  conference: string;
  confName: string;
  confWins: number;
  confLosses: number;
  nonConfWins: number;
  nonConfLosses: number;
  rating: number;
  totalWins: number;
  totalLosses: number;
  gamesPlayed: number;
  record: string;
  movement: number;
  poll_score: number;
  strength_of_record: number;
  strength_of_record_avg: number;
  last_rank: number | null;
  last_game: ScheduleGame | null;
  next_game: ScheduleGame | null;
}

export type LeagueStage =
  | 'preseason'
  | 'season'
  | 'summary'
  | 'realignment'
  | 'progression'
  | 'recruiting'
  | 'recruiting_summary'
  | 'roster_cuts';

export type OffseasonStage = Exclude<LeagueStage, 'preseason' | 'season'>;

export interface Info {
  currentWeek: number;
  lastRankingsWeek: number;
  currentYear: number;
  startYear: number;
  stage: LeagueStage;
  team: string;
  lastWeek: number;
}

export interface ScheduleGame {
  weekPlayed: number;
  opponent: {
    name: string;
    rating: number;
    ranking: number;
    record: string;
  } | null;
  label?: string;
  result: string;
  score: string;
  spread: string;
  moneyline: string;
  id: string;
  location?: 'Home' | 'Away' | 'Neutral';
  venue: string | null;
}

export type ConferenceStructurePolicy = 'historical' | 'current';
export type PostseasonFormatPolicy = 'historical' | 'custom';
export type PlayoffTeamCount = 2 | 4 | 12;

export interface NextSeasonConfiguration {
  conferencePolicy: ConferenceStructurePolicy;
  postseasonPolicy: PostseasonFormatPolicy;
  playoffTeams: PlayoffTeamCount;
  playoffAutobids: number;
  conferenceChampionsReceiveTopSeeds: boolean;
}

export interface HistoricalDataResolution {
  targetYear: number;
  sourceYear: number;
  resolution: 'exact' | 'fallback';
  atHistoricalFrontier: boolean;
}

export interface ConferenceChange {
  teamName: string;
  fromConference: string;
  toConference: string;
}

export type PostseasonChange =
  | {
      setting: 'playoffTeams' | 'playoffAutobids';
      currentValue: number;
      nextValue: number;
    }
  | {
      setting: 'conferenceChampionsReceiveTopSeeds';
      currentValue: boolean;
      nextValue: boolean;
    };

export interface NextSeasonPreview {
  dataSource: HistoricalDataResolution;
  historicalPostseason: {
    playoffTeams: PlayoffTeamCount;
    playoffAutobids: number;
    conferenceChampionsReceiveTopSeeds: boolean;
  };
  conferenceChanges: ConferenceChange[];
  postseasonChanges: PostseasonChange[];
}

export interface PreviewData {
  conferences: Array<{
    name: string;
    fullName: string;
    games: number;
  }>;
  teams: Array<{
    name: string;
    mascot: string;
    prestige: number;
    ceiling: number;
    floor: number;
    conferenceName: string | null;
  }>;
  playoff: {
    teams: PlayoffTeamCount;
    conf_champ_autobids: number;
    conf_champ_top_4: boolean;
  };
}

export type ConferenceGameSetting =
  | { mode: 'automatic' }
  | { mode: 'manual'; target: number };

export interface CustomConferencePlan {
  assignments: Record<string, string | null>;
  conferenceGames: Record<string, ConferenceGameSetting>;
}

export type NewLeagueConferenceSetup =
  | { mode: 'historical' }
  | { mode: 'custom'; plan: CustomConferencePlan };

export interface ConferencePlanIssue {
  code:
    | 'missing_team'
    | 'unknown_team'
    | 'unknown_conference'
    | 'missing_game_setting'
    | 'unknown_game_setting'
    | 'singleton_conference'
    | 'invalid_game_target'
    | 'impossible_schedule';
  message: string;
  conferenceName?: string;
  teamName?: string;
}

export interface RivalryPlanWarning {
  code: 'omitted_rivalry';
  teamA: string;
  teamB: string;
  name: string | null;
  message: string;
}

export interface RivalryDefinition {
  teamA: string;
  teamB: string;
  week: number | null;
  name: string | null;
  neutralSite: boolean;
  venue: string | null;
}

export interface RivalryConstraint extends RivalryDefinition {
  key: string;
  teamAId: number;
  teamBId: number;
}

export interface RivalryResolution {
  accepted: RivalryConstraint[];
  omitted: RivalryPlanWarning[];
  feasible: boolean;
}

export interface PendingRivalry {
  id: number;
  teamA: string;
  teamB: string;
  name: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  neutralSite: boolean;
  venue: string | null;
}

export interface ConferencePlanValidationResult {
  issues: ConferencePlanIssue[];
  warnings: RivalryPlanWarning[];
}

export interface ResolvedConferenceAlignment {
  assignments: Record<string, string | null>;
  conferenceGames: Record<string, number>;
  activeConferences: string[];
  issues: ConferencePlanIssue[];
}
