import type { Conference, Info, Team } from './domain';

export type SortDirection = 'asc' | 'desc';

export interface TeamStats {
  games: number;
  ppg: number;
  pass_cpg: number;
  pass_apg: number;
  comp_percent: number;
  pass_ypg: number;
  pass_tdpg: number;
  rush_apg: number;
  rush_ypg: number;
  rush_ypc: number;
  rush_tdpg: number;
  playspg: number;
  yardspg: number;
  ypp: number;
  first_downs_pass: number;
  first_downs_rush: number;
  first_downs_total: number;
  fumbles: number;
  interceptions: number;
  turnovers: number;
}

export type TeamStatKey = keyof TeamStats;
export type TeamStatsMode = 'offense' | 'defense';

export interface TeamStatsPageResult {
  info: Info;
  offense: Record<string, TeamStats>;
  defense: Record<string, TeamStats>;
  offense_averages: TeamStats;
  defense_averages: TeamStats;
  team: Team;
  conferences: Conference[];
}

export interface PassingStats {
  att: number;
  cmp: number;
  yards: number;
  td: number;
  int: number;
  pct: number;
  passer_rating: number;
  adjusted_pass_yards_per_attempt: number;
  yards_per_game: number;
}

export interface RushingStats {
  att: number;
  yards: number;
  td: number;
  fumbles: number;
  yards_per_rush: number;
  yards_per_game: number;
}

export interface ReceivingStats {
  rec: number;
  yards: number;
  td: number;
  yards_per_rec: number;
  yards_per_game: number;
}

export type IndividualStatsCategory = 'passing' | 'rushing' | 'receiving';
export type IndividualCategoryStats = {
  passing: PassingStats;
  rushing: RushingStats;
  receiving: ReceivingStats;
};

export interface IndividualPlayerData<TStats> {
  id: number;
  first: string;
  last: string;
  pos: string;
  team: string;
  gamesPlayed: number;
  stats: TStats;
}

export interface IndividualStatsPageResult {
  info: Info;
  team: Team;
  conferences: Conference[];
  stats: {
    passing: Record<string, IndividualPlayerData<PassingStats>>;
    rushing: Record<string, IndividualPlayerData<RushingStats>>;
    receiving: Record<string, IndividualPlayerData<ReceivingStats>>;
  };
}

export type StarRating = 1 | 2 | 3 | 4 | 5;
export type StarRatingRecord = Record<StarRating, number>;

export interface PrestigeStarsRow {
  prestige: number;
  team_count: number;
  average_stars: number;
  avg_rating: number;
  star_percentages: StarRatingRecord;
}

export interface RatingsStatsPageResult {
  info: Info;
  team: Team;
  prestige_stars_table: PrestigeStarsRow[];
  total_star_counts: {
    counts: StarRatingRecord;
    avg_ratings: StarRatingRecord;
    avg_ratings_fr: StarRatingRecord;
    avg_ratings_so: StarRatingRecord;
    avg_ratings_jr: StarRatingRecord;
    avg_ratings_sr: StarRatingRecord;
  };
  teams: Team[];
  conferences: Conference[];
}
