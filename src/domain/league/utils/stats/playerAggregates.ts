import type { GameLogRecord, GameRecord } from '../../../../types/db';
import type {
  DefenseStats,
  KickingStats,
  PassingStats,
  ReceivingStats,
  RushingStats,
} from '../../../../types/stats';
import { average, percentage } from '../../utils/statMath';

export type PlayerSeasonTotals = Omit<GameLogRecord, 'gameId'>;

export const emptyPlayerSeasonTotals = (playerId: number): PlayerSeasonTotals => ({
  playerId,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
});

export const currentSeasonGameIds = (games: GameRecord[], currentYear: number) =>
  new Set(
    games
      .filter(game => game.year === currentYear && game.winnerId !== null)
      .map(game => game.id),
  );

export const buildPlayerSeasonTotals = (
  gameLogs: GameLogRecord[],
  playedGameIds: Set<number>,
) => {
  const totals = new Map<number, PlayerSeasonTotals>();
  gameLogs.filter(log => playedGameIds.has(log.gameId)).forEach(log => {
    const total = totals.get(log.playerId) ?? emptyPlayerSeasonTotals(log.playerId);
    (Object.keys(total) as Array<keyof PlayerSeasonTotals>).forEach(key => {
      if (key !== 'playerId') total[key] += log[key];
    });
    totals.set(log.playerId, total);
  });
  return totals;
};

const passerRating = (
  completions: number,
  attempts: number,
  yards: number,
  touchdowns: number,
  interceptions: number,
) => {
  if (!attempts) return 0;
  const a = Math.max(0, Math.min(((completions / attempts) - 0.3) * 5, 2.375));
  const b = Math.max(0, Math.min(((yards / attempts) - 3) * 0.25, 2.375));
  const c = Math.max(0, Math.min((touchdowns / attempts) * 20, 2.375));
  const d = Math.max(0, Math.min(2.375 - ((interceptions / attempts) * 25), 2.375));
  return Math.round((((a + b + c + d) / 6) * 100) * 10) / 10;
};

const adjustedPassYardsPerAttempt = (
  yards: number,
  touchdowns: number,
  interceptions: number,
  attempts: number,
) => attempts
  ? Math.round(((yards + 20 * touchdowns - 45 * interceptions) / attempts) * 10) / 10
  : 0;

export const buildPassingStats = (
  total: PlayerSeasonTotals,
  gamesPlayed: number,
): PassingStats => ({
  att: total.pass_attempts,
  cmp: total.pass_completions,
  yards: total.pass_yards,
  td: total.pass_touchdowns,
  int: total.pass_interceptions,
  pct: percentage(total.pass_completions, total.pass_attempts),
  passer_rating: passerRating(
    total.pass_completions,
    total.pass_attempts,
    total.pass_yards,
    total.pass_touchdowns,
    total.pass_interceptions,
  ),
  adjusted_pass_yards_per_attempt: adjustedPassYardsPerAttempt(
    total.pass_yards,
    total.pass_touchdowns,
    total.pass_interceptions,
    total.pass_attempts,
  ),
  yards_per_game: average(total.pass_yards, gamesPlayed),
});

export const buildRushingStats = (
  total: PlayerSeasonTotals,
  gamesPlayed: number,
): RushingStats => ({
  att: total.rush_attempts,
  yards: total.rush_yards,
  td: total.rush_touchdowns,
  fumbles: total.fumbles,
  yards_per_rush: average(total.rush_yards, total.rush_attempts),
  yards_per_game: average(total.rush_yards, gamesPlayed),
});

export const buildReceivingStats = (
  total: PlayerSeasonTotals,
  gamesPlayed: number,
): ReceivingStats => ({
  rec: total.receiving_catches,
  yards: total.receiving_yards,
  td: total.receiving_touchdowns,
  yards_per_rec: average(total.receiving_yards, total.receiving_catches),
  yards_per_game: average(total.receiving_yards, gamesPlayed),
});

export const buildDefenseStats = (total: PlayerSeasonTotals): DefenseStats => ({
  tackles: total.tackles,
  sacks: total.sacks,
  interceptions: total.interceptions,
  fumbles_forced: total.fumbles_forced,
  fumbles_recovered: total.fumbles_recovered,
});

export const buildKickingStats = (total: PlayerSeasonTotals): KickingStats => ({
  field_goals_made: total.field_goals_made,
  field_goals_attempted: total.field_goals_attempted,
  field_goal_percent: percentage(total.field_goals_made, total.field_goals_attempted),
  extra_points_made: total.extra_points_made,
  extra_points_attempted: total.extra_points_attempted,
  extra_point_percent: percentage(total.extra_points_made, total.extra_points_attempted),
  points: total.field_goals_made * 3 + total.extra_points_made,
});
