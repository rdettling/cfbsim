import type { Conference, Info, Team } from './domain';

export type SortDirection = 'asc' | 'desc';

export interface TeamAggregateTotals {
  games: number;
  points: number;
  pass_completions: number;
  pass_attempts: number;
  pass_yards: number;
  pass_touchdowns: number;
  rush_attempts: number;
  rush_yards: number;
  rush_touchdowns: number;
  plays: number;
  first_downs_pass: number;
  first_downs_rush: number;
  fumbles: number;
  interceptions: number;
}

export interface TeamAggregateStats {
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

export type TeamAggregateStatKey = keyof TeamAggregateStats;
export type TeamAggregateMode = 'offense' | 'defense';

export interface TeamRankingsPageResult {
  info: Info;
  offense: Record<string, TeamAggregateStats>;
  defense: Record<string, TeamAggregateStats>;
  offense_averages: TeamAggregateStats;
  defense_averages: TeamAggregateStats;
  team: Team;
  conferences: Conference[];
  years: number[];
  selectedYear: number;
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

export type PlayerLeaderboardCategory = 'passing' | 'rushing' | 'receiving';
export type PlayerLeaderboardStatKey =
  | keyof PassingStats
  | keyof RushingStats
  | keyof ReceivingStats;
export type PlayerLeaderboardStatValues = Partial<
  Record<PlayerLeaderboardStatKey, number>
>;

export interface PlayerLeaderboardEntry<TStats> {
  id: number;
  first: string;
  last: string;
  pos: string;
  team: string;
  gamesPlayed: number;
  stats: TStats;
}

export interface PlayerLeadersPageResult {
  info: Info;
  team: Team;
  conferences: Conference[];
  years: number[];
  selectedYear: number;
  stats: {
    passing: Record<string, PlayerLeaderboardEntry<PassingStats>>;
    rushing: Record<string, PlayerLeaderboardEntry<RushingStats>>;
    receiving: Record<string, PlayerLeaderboardEntry<ReceivingStats>>;
  };
}

export interface DefenseStats {
  tackles: number;
  sacks: number;
  interceptions: number;
  fumbles_forced: number;
  fumbles_recovered: number;
}

export interface KickingStats {
  field_goals_made: number;
  field_goals_attempted: number;
  field_goal_percent: number;
  extra_points_made: number;
  extra_points_attempted: number;
  extra_point_percent: number;
  points: number;
}

export type TeamPlayerStatsCategory =
  | 'passing'
  | 'rushing'
  | 'receiving'
  | 'defense'
  | 'kicking';

export type TeamPlayerStatKey =
  | PlayerLeaderboardStatKey
  | keyof DefenseStats
  | keyof KickingStats;
export type TeamPlayerStatValues = Partial<Record<TeamPlayerStatKey, number>>;

export interface TeamPlayerStatsEntry<TStats> {
  id: number;
  first: string;
  last: string;
  pos: string;
  stats: TStats;
}

export interface RankedTeamAggregateStats {
  values: TeamAggregateStats;
  ranks: Record<TeamAggregateStatKey, number>;
}

export interface TeamStatsPageResult {
  info: Info;
  team: Team;
  teams: string[];
  conferences: Conference[];
  years: number[];
  selectedYear: number;
  teamStats: Record<TeamAggregateMode, RankedTeamAggregateStats>;
  playerStats: {
    passing: Array<TeamPlayerStatsEntry<PassingStats>>;
    rushing: Array<TeamPlayerStatsEntry<RushingStats>>;
    receiving: Array<TeamPlayerStatsEntry<ReceivingStats>>;
    defense: Array<TeamPlayerStatsEntry<DefenseStats>>;
    kicking: Array<TeamPlayerStatsEntry<KickingStats>>;
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
