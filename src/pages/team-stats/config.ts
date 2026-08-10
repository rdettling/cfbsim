import type {
  TeamPlayerStatKey,
  TeamPlayerStatsCategory,
  TeamPlayerStatValues,
} from '../../types/stats';

type TeamPlayerCompositeColumnKey = 'field_goals' | 'extra_points';

export type TeamPlayerStatColumn = {
  key: TeamPlayerStatKey | TeamPlayerCompositeColumnKey;
  sortKey: TeamPlayerStatKey;
  label: string;
  mobileLabel: string;
  format?: 'integer' | 'decimal' | 'percent' | 'field-goals' | 'extra-points';
};

const column = (
  key: TeamPlayerStatKey,
  label: string,
  mobileLabel: string,
  format: TeamPlayerStatColumn['format'] = 'integer',
): TeamPlayerStatColumn => ({ key, sortKey: key, label, mobileLabel, format });

const compositeColumn = (
  key: TeamPlayerCompositeColumnKey,
  sortKey: TeamPlayerStatKey,
  label: string,
  mobileLabel: string,
  format: 'field-goals' | 'extra-points',
): TeamPlayerStatColumn => ({ key, sortKey, label, mobileLabel, format });

const passing = [
  column('cmp', 'CMP', 'Completions'),
  column('att', 'ATT', 'Attempts'),
  column('pct', 'PCT', 'Completion %', 'percent'),
  column('yards', 'YDS', 'Passing yards'),
  column('td', 'TD', 'Touchdowns'),
  column('int', 'INT', 'Interceptions'),
  column('passer_rating', 'RTG', 'Passer rating', 'decimal'),
  column('adjusted_pass_yards_per_attempt', 'AY/A', 'Adjusted yards / attempt', 'decimal'),
  column('yards_per_game', 'Y/G', 'Yards / game', 'decimal'),
] satisfies TeamPlayerStatColumn[];

const rushing = [
  column('att', 'ATT', 'Attempts'),
  column('yards', 'YDS', 'Rushing yards'),
  column('yards_per_rush', 'AVG', 'Yards / carry', 'decimal'),
  column('td', 'TD', 'Touchdowns'),
  column('fumbles', 'FUM', 'Fumbles'),
  column('yards_per_game', 'Y/G', 'Yards / game', 'decimal'),
] satisfies TeamPlayerStatColumn[];

const receiving = [
  column('rec', 'REC', 'Receptions'),
  column('yards', 'YDS', 'Receiving yards'),
  column('yards_per_rec', 'AVG', 'Yards / reception', 'decimal'),
  column('td', 'TD', 'Touchdowns'),
  column('yards_per_game', 'Y/G', 'Yards / game', 'decimal'),
] satisfies TeamPlayerStatColumn[];

const defense = [
  column('tackles', 'TKL', 'Tackles'),
  column('sacks', 'SACK', 'Sacks'),
  column('interceptions', 'INT', 'Interceptions'),
  column('fumbles_forced', 'FF', 'Fumbles forced'),
  column('fumbles_recovered', 'FR', 'Fumbles recovered'),
] satisfies TeamPlayerStatColumn[];

const kicking = [
  compositeColumn('field_goals', 'field_goals_made', 'FG', 'Field goals', 'field-goals'),
  column('field_goal_percent', 'FG%', 'Field goal %', 'percent'),
  compositeColumn('extra_points', 'extra_points_made', 'XP', 'Extra points', 'extra-points'),
  column('extra_point_percent', 'XP%', 'Extra point %', 'percent'),
  column('points', 'PTS', 'Points'),
] satisfies TeamPlayerStatColumn[];

export const TEAM_PLAYER_COLUMNS: Record<TeamPlayerStatsCategory, TeamPlayerStatColumn[]> = {
  passing,
  rushing,
  receiving,
  defense,
  kicking,
};

export const TEAM_PLAYER_CATEGORY_LABELS: Record<TeamPlayerStatsCategory, string> = {
  passing: 'Passing',
  rushing: 'Rushing',
  receiving: 'Receiving',
  defense: 'Defense',
  kicking: 'Kicking',
};

export const DEFAULT_TEAM_PLAYER_SORT: Record<TeamPlayerStatsCategory, TeamPlayerStatKey> = {
  passing: 'yards',
  rushing: 'yards',
  receiving: 'yards',
  defense: 'tackles',
  kicking: 'points',
};

export const formatTeamPlayerStat = (
  stats: TeamPlayerStatValues,
  column: TeamPlayerStatColumn,
) => {
  const key = column.key;
  if (key === 'field_goals') {
    return `${stats.field_goals_made ?? 0}/${stats.field_goals_attempted ?? 0}`;
  }
  if (key === 'extra_points') {
    return `${stats.extra_points_made ?? 0}/${stats.extra_points_attempted ?? 0}`;
  }
  const value = stats[key] ?? 0;
  if (column.format === 'percent') return `${value.toFixed(1)}%`;
  if (column.format === 'decimal') return value.toFixed(1);
  return value.toLocaleString();
};
