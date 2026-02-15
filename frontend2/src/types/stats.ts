import type { Conference, Info, Team } from './domain';

export interface TeamStatsType {
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

export interface TeamStatsPageData {
  info: Info;
  offense: Record<string, TeamStatsType>;
  defense: Record<string, TeamStatsType>;
  offense_averages: TeamStatsType;
  defense_averages: TeamStatsType;
  team: Team;
  conferences: Conference[];
}

export interface TeamStatsSortConfig {
  field: keyof TeamStatsType;
  direction: 'asc' | 'desc';
}

export interface TeamStatsColumnConfig {
  key: keyof TeamStatsType;
  label: string;
  width: string;
  sortable: boolean;
  defaultDirection?: 'asc' | 'desc';
}

export interface IndividualPlayerData {
  id: number;
  first: string;
  last: string;
  pos: string;
  team: string;
  gamesPlayed: number;
  stats: Record<string, number>;
}

export interface IndividualStatsPageData {
  info: Info;
  team: Team;
  conferences: Conference[];
  stats: Record<string, Record<string, IndividualPlayerData>>;
}

export interface RatingsStatsData {
  info: Info;
  team: Team;
  prestige_stars_table: Array<{
    prestige: number;
    avg_rating: number;
    avg_stars: number;
    star_percentages: Record<number, number>;
  }>;
  total_star_counts: {
    counts: Record<number, number>;
    avg_ratings: Record<number, number>;
    avg_ratings_fr: Record<number, number>;
    avg_ratings_so: Record<number, number>;
    avg_ratings_jr: Record<number, number>;
    avg_ratings_sr: Record<number, number>;
  };
  team_counts_by_prestige: Array<{ prestige: number; team_count: number }>;
  teams: Team[];
  conferences: Conference[];
}
