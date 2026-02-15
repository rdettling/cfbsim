import type { DBSchema } from 'idb';

export const DB_NAME = 'cfbsim';
export const DB_VERSION = 1;

export const STORE_NAMES = {
  info: 'info',
  settings: 'settings',
  teams: 'teams',
  players: 'players',
  games: 'games',
  playoff: 'playoff',
  history: 'history',
  conferences: 'conferences',
  odds: 'odds',
  recruits: 'recruits',
  offers: 'offers',
  awards: 'awards',
  gameLogs: 'gameLogs',
  drives: 'drives',
  plays: 'plays',
  baseData: 'baseData',
} as const;

export const EXPECTED_STORES: readonly string[] = Object.values(STORE_NAMES);

export const DEFAULT_INFO_ID = 'default';

export interface InfoRecord {
  user_id: string;
  currentWeek: number | null;
  currentYear: number | null;
  startYear: number | null;
  lastWeek: number | null;
  team_id: number | null;
  playoff_id: number | null;
  stage: string | null;
}

export interface SettingsRecord {
  id: number;
  info_id: string;
  playoff_teams: number;
  playoff_autobids: number | null;
  playoff_conf_champ_top_4: boolean;
  auto_realignment: boolean;
  auto_update_postseason_format: boolean;
}

export interface TeamRecord {
  id: number;
  info_id: string;
  name: string;
  abbreviation: string;
  prestige: number;
  prestige_change: number;
  rating: number | null;
  offense: number | null;
  defense: number | null;
  mascot: string;
  colorPrimary: string;
  colorSecondary: string;
  city: string | null;
  state: string | null;
  stadium: string | null;
  conference_id: number | null;
  confGames: number;
  confLimit: number;
  confWins: number;
  confLosses: number;
  nonConfGames: number;
  nonConfLimit: number;
  nonConfWins: number;
  nonConfLosses: number;
  gamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  strength_of_record: number;
  poll_score: number;
  ranking: number | null;
  last_rank: number | null;
  offers: number;
  recruiting_points: number;
}

export interface PlayerRecord {
  id: number;
  info_id: string;
  team_id: number;
  first: string;
  last: string;
  year: string;
  pos: string;
  rating: number;
  rating_fr: number;
  rating_so: number;
  rating_jr: number;
  rating_sr: number;
  stars: number;
  development_trait: number;
  starter: boolean;
  active: boolean;
}

export interface HistoryRecord {
  id: number;
  info_id: string;
  team_id: number;
  year: number;
  prestige: number | null;
  rating: number | null;
  wins: number;
  losses: number;
  rank: number;
  conference: string;
}

export interface GameLogRecord {
  id: number;
  info_id: string;
  player_id: number;
  game_id: number;
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

export interface GameRecord {
  id: number;
  info_id: string;
  teamA_id: number;
  teamB_id: number;
  homeTeam_id: number | null;
  awayTeam_id: number | null;
  neutralSite: boolean;
  winner_id: number | null;
  base_label: string;
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
  scoreA: number | null;
  scoreB: number | null;
  headline: string | null;
  watchability: number | null;
}

export interface ConferenceRecord {
  id: number;
  info_id: string;
  confName: string;
  confFullName: string;
  confGames: number;
  championship_id: number | null;
}

export interface OddsRecord {
  id: number;
  info_id: string;
  diff: number;
  favSpread: string;
  udSpread: string;
  favWinProb: number;
  udWinProb: number;
  favMoneyline: string;
  udMoneyline: string;
}

export interface DriveRecord {
  id: number;
  info_id: string;
  game_id: number;
  driveNum: number;
  offense_id: number;
  defense_id: number;
  startingFP: number;
  result: string;
  points: number;
  points_needed: number;
  scoreAAfter: number;
  scoreBAfter: number;
}

export interface PlayRecord {
  id: number;
  info_id: string;
  game_id: number;
  drive_id: number;
  offense_id: number;
  defense_id: number;
  startingFP: number;
  down: number;
  yardsLeft: number;
  playType: string;
  yardsGained: number;
  result: string;
  text: string;
  header: string;
  scoreA: number;
  scoreB: number;
}

export interface PlayoffRecord {
  id: number;
  info_id: string;
  seed_1: number | null;
  seed_2: number | null;
  seed_3: number | null;
  seed_4: number | null;
  seed_5: number | null;
  seed_6: number | null;
  seed_7: number | null;
  seed_8: number | null;
  seed_9: number | null;
  seed_10: number | null;
  seed_11: number | null;
  seed_12: number | null;
  left_r1_1: number | null;
  left_r1_2: number | null;
  right_r1_1: number | null;
  right_r1_2: number | null;
  left_quarter_1: number | null;
  left_quarter_2: number | null;
  right_quarter_1: number | null;
  right_quarter_2: number | null;
  left_semi: number | null;
  right_semi: number | null;
  natty: number | null;
}

export interface RecruitRecord {
  id: number;
  info_id: string;
  first: string;
  last: string;
  pos: string;
  overall_rank: number;
  state_rank: number;
  position_rank: number;
  stars: number;
  state: string;
  min_prestige: number;
  committed_team_id: number | null;
}

export interface OfferRecord {
  id: number;
  info_id: string;
  recruit_id: number;
  team_id: number;
  interest_level: number;
}

export type AwardStats = Record<string, unknown>;

export interface AwardRecord {
  id: number;
  info_id: string;
  slug: string;
  name: string | null;
  description: string | null;
  is_final: boolean;
  calculated_year: number | null;
  calculated_week: number | null;
  last_updated: string;
  first_place_id: number | null;
  first_score: number | null;
  first_stats: AwardStats | null;
  second_place_id: number | null;
  second_score: number | null;
  second_stats: AwardStats | null;
  third_place_id: number | null;
  third_score: number | null;
  third_stats: AwardStats | null;
}

export interface BaseDataRecord {
  key: string;
  value: unknown;
}

export interface CFBSimDB extends DBSchema {
  info: {
    key: string;
    value: InfoRecord;
  };
  settings: {
    key: number;
    value: SettingsRecord;
    indexes: { infoId: string };
  };
  teams: {
    key: number;
    value: TeamRecord;
  };
  players: {
    key: number;
    value: PlayerRecord;
    indexes: {
      teamIdPosRating: [number, string, number];
      teamIdPosActive: [number, string, boolean];
      activePos: [boolean, string];
    };
  };
  games: {
    key: number;
    value: GameRecord;
  };
  playoff: {
    key: number;
    value: PlayoffRecord;
  };
  history: {
    key: number;
    value: HistoryRecord;
  };
  conferences: {
    key: number;
    value: ConferenceRecord;
  };
  odds: {
    key: number;
    value: OddsRecord;
  };
  recruits: {
    key: number;
    value: RecruitRecord;
  };
  offers: {
    key: number;
    value: OfferRecord;
    indexes: { recruitIdTeamId: [number, number] };
  };
  awards: {
    key: number;
    value: AwardRecord;
    indexes: { infoIdSlugFinal: [string, string, boolean] };
  };
  gameLogs: {
    key: number;
    value: GameLogRecord;
  };
  drives: {
    key: number;
    value: DriveRecord;
  };
  plays: {
    key: number;
    value: PlayRecord;
  };
  baseData: {
    key: string;
    value: BaseDataRecord;
  };
}
