import type { ScheduleGame } from './domain';

export type PlayerStatCategory =
  | 'passing'
  | 'rushing'
  | 'receiving'
  | 'kicking'
  | 'defense'
  | 'participation';

export type PlayerStatKey =
  | 'pass_completions'
  | 'pass_attempts'
  | 'completion_percentage'
  | 'pass_yards'
  | 'pass_touchdowns'
  | 'pass_interceptions'
  | 'passer_rating'
  | 'adjusted_pass_yards_per_attempt'
  | 'rush_attempts'
  | 'rush_yards'
  | 'yards_per_rush'
  | 'rush_touchdowns'
  | 'receiving_catches'
  | 'receiving_yards'
  | 'yards_per_rec'
  | 'receiving_touchdowns'
  | 'field_goals_made'
  | 'field_goals_attempted'
  | 'field_goal_percent'
  | 'tackles'
  | 'sacks'
  | 'interceptions'
  | 'fumbles_forced'
  | 'fumbles_recovered';

export type PlayerStatValues = Partial<Record<PlayerStatKey, number>>;

export interface PlayerCareerSeason {
  classYear: string;
  rating: number;
  games: number;
  stats: PlayerStatValues;
}

export interface PlayerGameLog {
  game: ScheduleGame;
  stats: PlayerStatValues;
}
