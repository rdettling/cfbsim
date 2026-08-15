import type { GameLogRecord } from '../../../types/db';

export type AwardStatLineStats = Pick<
  GameLogRecord,
  | 'pass_yards'
  | 'pass_attempts'
  | 'pass_completions'
  | 'pass_touchdowns'
  | 'pass_interceptions'
  | 'rush_yards'
  | 'rush_attempts'
  | 'rush_touchdowns'
  | 'receiving_yards'
  | 'receiving_catches'
  | 'receiving_touchdowns'
  | 'fumbles'
  | 'tackles'
  | 'sacks'
  | 'interceptions'
  | 'fumbles_forced'
  | 'fumbles_recovered'
  | 'field_goals_made'
  | 'field_goals_attempted'
  | 'extra_points_made'
  | 'extra_points_attempted'
>;

export const formatAwardStatLine = (stats: AwardStatLineStats) => {
  const parts: string[] = [];
  const hasOffensiveStats = Boolean(
    stats.pass_attempts || stats.rush_attempts || stats.receiving_catches,
  );

  if (stats.pass_attempts) {
    parts.push(
      `${stats.pass_completions}/${stats.pass_attempts}, ${stats.pass_yards} pass yds, ${stats.pass_touchdowns} pass TD, ${stats.pass_interceptions} INT`,
    );
  }

  if (stats.rush_attempts) {
    parts.push(
      `${stats.rush_attempts} carries, ${stats.rush_yards} rush yds, ${stats.rush_touchdowns} rush TD`,
    );
  }

  if (stats.receiving_catches) {
    parts.push(
      `${stats.receiving_catches} catches, ${stats.receiving_yards} rec yds, ${stats.receiving_touchdowns} rec TD`,
    );
  }

  if (hasOffensiveStats && stats.fumbles) {
    parts.push(`${stats.fumbles} FUM`);
  }

  if (
    stats.tackles
    || stats.sacks
    || stats.interceptions
    || stats.fumbles_forced
    || stats.fumbles_recovered
  ) {
    parts.push(
      `${stats.tackles} tackles, ${stats.sacks} sacks, ${stats.interceptions} INT, ${stats.fumbles_forced} FF, ${stats.fumbles_recovered} FR`,
    );
  }

  if (stats.field_goals_attempted || stats.extra_points_attempted) {
    parts.push(
      `${stats.field_goals_made}/${stats.field_goals_attempted} FG, ${stats.extra_points_made}/${stats.extra_points_attempted} XP`,
    );
  }

  return parts.length ? parts.join(' · ') : 'No stats yet';
};
