import type {
  PlayerStatCategory,
  PlayerStatKey,
  PlayerStatValues,
} from '../../types/player';

export type PlayerStatColumn = {
  key: PlayerStatKey;
  label: string;
  mobileLabel: string;
  format?: 'integer' | 'decimal' | 'percent';
  career?: boolean;
  game?: boolean;
  primary?: boolean;
};

export const PLAYER_STAT_COLUMNS: Record<PlayerStatCategory, PlayerStatColumn[]> = {
  passing: [
    { key: 'pass_completions', label: 'CMP', mobileLabel: 'Completions', format: 'integer' },
    { key: 'pass_attempts', label: 'ATT', mobileLabel: 'Attempts', format: 'integer' },
    { key: 'completion_percentage', label: 'PCT', mobileLabel: 'Completion %', format: 'percent' },
    { key: 'pass_yards', label: 'YDS', mobileLabel: 'Passing yards', format: 'integer', primary: true },
    { key: 'pass_touchdowns', label: 'TD', mobileLabel: 'Passing TD', format: 'integer', primary: true },
    { key: 'pass_interceptions', label: 'INT', mobileLabel: 'Interceptions', format: 'integer', primary: true },
    { key: 'passer_rating', label: 'RTG', mobileLabel: 'Passer rating', format: 'decimal' },
    {
      key: 'adjusted_pass_yards_per_attempt',
      label: 'AY/A',
      mobileLabel: 'Adjusted yards / attempt',
      format: 'decimal',
      game: false,
    },
  ],
  rushing: [
    { key: 'rush_attempts', label: 'ATT', mobileLabel: 'Rush attempts', format: 'integer' },
    { key: 'rush_yards', label: 'RUSH', mobileLabel: 'Rushing yards', format: 'integer', primary: true },
    { key: 'yards_per_rush', label: 'AVG', mobileLabel: 'Yards / carry', format: 'decimal', game: false },
    { key: 'rush_touchdowns', label: 'R TD', mobileLabel: 'Rushing TD', format: 'integer', primary: true },
    { key: 'receiving_catches', label: 'REC', mobileLabel: 'Receptions', format: 'integer' },
    { key: 'receiving_yards', label: 'REC YDS', mobileLabel: 'Receiving yards', format: 'integer', primary: true },
    { key: 'yards_per_rec', label: 'REC AVG', mobileLabel: 'Yards / reception', format: 'decimal' },
    { key: 'receiving_touchdowns', label: 'REC TD', mobileLabel: 'Receiving TD', format: 'integer' },
  ],
  receiving: [
    { key: 'receiving_catches', label: 'REC', mobileLabel: 'Receptions', format: 'integer', primary: true },
    { key: 'receiving_yards', label: 'YDS', mobileLabel: 'Receiving yards', format: 'integer', primary: true },
    { key: 'yards_per_rec', label: 'AVG', mobileLabel: 'Yards / reception', format: 'decimal' },
    { key: 'receiving_touchdowns', label: 'TD', mobileLabel: 'Receiving TD', format: 'integer', primary: true },
  ],
  kicking: [
    { key: 'field_goals_made', label: 'FGM', mobileLabel: 'Field goals made', format: 'integer', primary: true },
    { key: 'field_goals_attempted', label: 'FGA', mobileLabel: 'Field goals attempted', format: 'integer', primary: true },
    { key: 'field_goal_percent', label: 'FG%', mobileLabel: 'Field goal %', format: 'percent', primary: true },
  ],
  defense: [
    { key: 'tackles', label: 'TKL', mobileLabel: 'Tackles', format: 'integer', career: false, primary: true },
    { key: 'sacks', label: 'SACK', mobileLabel: 'Sacks', format: 'integer', career: false, primary: true },
    { key: 'interceptions', label: 'INT', mobileLabel: 'Interceptions', format: 'integer', career: false, primary: true },
    { key: 'fumbles_forced', label: 'FF', mobileLabel: 'Fumbles forced', format: 'integer', career: false },
    { key: 'fumbles_recovered', label: 'FR', mobileLabel: 'Fumbles recovered', format: 'integer', career: false },
  ],
  participation: [],
};

export const getCareerColumns = (category: PlayerStatCategory) =>
  PLAYER_STAT_COLUMNS[category].filter(column => column.career !== false);

export const getGameColumns = (category: PlayerStatCategory) =>
  PLAYER_STAT_COLUMNS[category].filter(column => column.game !== false);

export const getPrimaryGameColumns = (category: PlayerStatCategory) =>
  getGameColumns(category).filter(column => column.primary).slice(0, 3);

export const formatPlayerStat = (
  stats: PlayerStatValues,
  column: PlayerStatColumn
) => {
  const value = stats[column.key] ?? 0;
  if (column.format === 'percent') return `${value.toFixed(1)}%`;
  if (column.format === 'decimal') return value.toFixed(1);
  return value.toLocaleString();
};
