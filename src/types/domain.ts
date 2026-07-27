export interface Conference {
  id: number;
  confName: string;
  confFullName: string;
  confGames: number;
  info: string;
  championship: null | any;
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
  prestige_change?: number;
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
  confName?: string;
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
  strength_of_record_avg?: number;
  last_rank?: number;
  last_game: ScheduleGame | null;
  next_game: ScheduleGame | null;
}

export type LeagueStage =
  | 'preseason'
  | 'season'
  | 'summary'
  | 'realignment'
  | 'progression'
  | 'recruiting_summary'
  | 'roster_cuts';

export type OffseasonStage = Exclude<LeagueStage, 'preseason' | 'season'>;

export interface Info {
  currentWeek: number;
  currentYear: number;
  startYear?: number;
  stage: LeagueStage;
  team: string;
  lastWeek: number;
  averageTeamRating?: number;
  colorPrimary?: string;
  colorSecondary?: string;
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
}

export interface Settings {
  playoff_teams: number;
  playoff_autobids?: number;
  playoff_conf_champ_top_4?: boolean;
  auto_realignment: boolean;
  auto_update_postseason_format: boolean;
}

export type ConferenceStructurePolicy = 'historical' | 'current';
export type PostseasonFormatPolicy = 'historical' | 'custom';
export type PlayoffTeamCount = 2 | 4 | 12;

export interface NextSeasonConfiguration {
  conferencePolicy: ConferenceStructurePolicy;
  postseasonPolicy: PostseasonFormatPolicy;
  playoffTeams: PlayoffTeamCount;
  playoffAutobids?: number;
  conferenceChampionsReceiveTopSeeds?: boolean;
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
