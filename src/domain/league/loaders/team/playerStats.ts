import type { GameLogRecord, PlayerSeasonStats } from '../../../../types/db';
import type {
  PlayerCareerSeason,
  PlayerGameLog,
  PlayerStatCategory,
  PlayerStatValues,
} from '../../../../types/player';
import { average, percentage } from '../../utils/statMath';

export const passerRating = (
  completions: number,
  attempts: number,
  yards: number,
  touchdowns: number,
  interceptions: number,
) => {
  if (!attempts) return 0;
  const a = Math.max(0, Math.min((completions / attempts - 0.3) * 5, 2.375));
  const b = Math.max(0, Math.min((yards / attempts - 3) * 0.25, 2.375));
  const c = Math.max(0, Math.min((touchdowns / attempts) * 20, 2.375));
  const d = Math.max(0, Math.min(2.375 - (interceptions / attempts) * 25, 2.375));
  return Math.round((((a + b + c + d) / 6) * 100) * 10) / 10;
};

export const adjustedPassYardsPerAttempt = (
  passingYards: number,
  touchdownPasses: number,
  interceptions: number,
  passAttempts: number,
) => {
  if (!passAttempts) return 0;
  const value = (
    passingYards + 20 * touchdownPasses - 45 * interceptions
  ) / passAttempts;
  return Math.round(value * 10) / 10;
};

export const getPlayerStatCategory = (position: string): PlayerStatCategory => {
  if (position === 'qb') return 'passing';
  if (position === 'rb') return 'rushing';
  if (position === 'wr' || position === 'te') return 'receiving';
  if (position === 'k') return 'kicking';
  if (['dl', 'lb', 'cb', 's'].includes(position)) return 'defense';
  return 'participation';
};

type CareerSeasonValues = PlayerSeasonStats & {
  completion_percentage: number;
  rush_ypa: number;
  receiving_ypr: number;
  field_goal_percent: number;
  passer_rating: number;
  adjusted_pass_yards_per_attempt: number;
};

export const getPositionStats = (
  position: string,
  values: CareerSeasonValues,
): PlayerCareerSeason => {
  const category = getPlayerStatCategory(position);
  let stats: PlayerStatValues = {};

  if (category === 'passing') {
    stats = {
      pass_completions: values.pass_completions,
      pass_attempts: values.pass_attempts,
      completion_percentage: values.completion_percentage,
      pass_yards: values.pass_yards,
      pass_touchdowns: values.pass_touchdowns,
      pass_interceptions: values.pass_interceptions,
      passer_rating: values.passer_rating,
      adjusted_pass_yards_per_attempt: values.adjusted_pass_yards_per_attempt,
    };
  } else if (category === 'rushing') {
    stats = {
      rush_attempts: values.rush_attempts,
      rush_yards: values.rush_yards,
      yards_per_rush: values.rush_ypa,
      rush_touchdowns: values.rush_touchdowns,
      receiving_catches: values.receiving_catches,
      receiving_yards: values.receiving_yards,
      yards_per_rec: values.receiving_ypr,
      receiving_touchdowns: values.receiving_touchdowns,
    };
  } else if (category === 'receiving') {
    stats = {
      receiving_catches: values.receiving_catches,
      receiving_yards: values.receiving_yards,
      yards_per_rec: values.receiving_ypr,
      receiving_touchdowns: values.receiving_touchdowns,
    };
  } else if (category === 'kicking') {
    stats = {
      field_goals_made: values.field_goals_made,
      field_goals_attempted: values.field_goals_attempted,
      field_goal_percent: values.field_goal_percent,
    };
  }

  return {
    classYear: values.classYear,
    rating: values.rating,
    games: values.games,
    stats,
  };
};

export const getPositionGameLog = (
  position: string,
  log: GameLogRecord,
  game: PlayerGameLog['game'],
): PlayerGameLog => {
  const category = getPlayerStatCategory(position);
  let stats: PlayerStatValues = {};

  if (category === 'passing') {
    stats = {
      pass_completions: log.pass_completions,
      pass_attempts: log.pass_attempts,
      completion_percentage: percentage(log.pass_completions, log.pass_attempts),
      pass_yards: log.pass_yards,
      pass_touchdowns: log.pass_touchdowns,
      pass_interceptions: log.pass_interceptions,
      passer_rating: passerRating(
        log.pass_completions,
        log.pass_attempts,
        log.pass_yards,
        log.pass_touchdowns,
        log.pass_interceptions,
      ),
    };
  } else if (category === 'rushing') {
    stats = {
      rush_attempts: log.rush_attempts,
      rush_yards: log.rush_yards,
      rush_touchdowns: log.rush_touchdowns,
      receiving_catches: log.receiving_catches,
      receiving_yards: log.receiving_yards,
      yards_per_rec: average(log.receiving_yards, log.receiving_catches),
      receiving_touchdowns: log.receiving_touchdowns,
    };
  } else if (category === 'receiving') {
    stats = {
      receiving_catches: log.receiving_catches,
      receiving_yards: log.receiving_yards,
      yards_per_rec: average(log.receiving_yards, log.receiving_catches),
      receiving_touchdowns: log.receiving_touchdowns,
    };
  } else if (category === 'kicking') {
    stats = {
      field_goals_made: log.field_goals_made,
      field_goals_attempted: log.field_goals_attempted,
      field_goal_percent: percentage(log.field_goals_made, log.field_goals_attempted),
    };
  } else if (category === 'defense') {
    stats = {
      tackles: log.tackles,
      sacks: log.sacks,
      interceptions: log.interceptions,
      fumbles_forced: log.fumbles_forced,
      fumbles_recovered: log.fumbles_recovered,
    };
  }

  return { game, stats };
};
