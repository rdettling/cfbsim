import type {
  PlayerLeaderboardCategory,
  PlayerLeaderboardStatKey,
  PassingStats,
  ReceivingStats,
  RushingStats,
} from '../../types/stats';

export type PlayerLeaderboardColumn = {
  key: PlayerLeaderboardStatKey;
  label: string;
  mobileLabel: string;
  format?: 'integer' | 'decimal' | 'percent';
};

const passingColumns = [
  { key: 'att', label: 'ATT', mobileLabel: 'Attempts', format: 'integer' },
  { key: 'cmp', label: 'CMP', mobileLabel: 'Completions', format: 'integer' },
  { key: 'yards', label: 'YDS', mobileLabel: 'Passing yards', format: 'integer' },
  { key: 'td', label: 'TD', mobileLabel: 'Touchdowns', format: 'integer' },
  { key: 'int', label: 'INT', mobileLabel: 'Interceptions', format: 'integer' },
  { key: 'pct', label: 'PCT', mobileLabel: 'Completion %', format: 'percent' },
  { key: 'passer_rating', label: 'RTG', mobileLabel: 'Passer rating', format: 'decimal' },
  { key: 'adjusted_pass_yards_per_attempt', label: 'AY/A', mobileLabel: 'Adjusted yards / attempt', format: 'decimal' },
  { key: 'yards_per_game', label: 'Y/G', mobileLabel: 'Yards / game', format: 'decimal' },
] satisfies Array<PlayerLeaderboardColumn & { key: keyof PassingStats }>;

const rushingColumns = [
  { key: 'att', label: 'ATT', mobileLabel: 'Attempts', format: 'integer' },
  { key: 'yards', label: 'YDS', mobileLabel: 'Rushing yards', format: 'integer' },
  { key: 'td', label: 'TD', mobileLabel: 'Touchdowns', format: 'integer' },
  { key: 'fumbles', label: 'FUM', mobileLabel: 'Fumbles', format: 'integer' },
  { key: 'yards_per_rush', label: 'AVG', mobileLabel: 'Yards / carry', format: 'decimal' },
  { key: 'yards_per_game', label: 'Y/G', mobileLabel: 'Yards / game', format: 'decimal' },
] satisfies Array<PlayerLeaderboardColumn & { key: keyof RushingStats }>;

const receivingColumns = [
  { key: 'rec', label: 'REC', mobileLabel: 'Receptions', format: 'integer' },
  { key: 'yards', label: 'YDS', mobileLabel: 'Receiving yards', format: 'integer' },
  { key: 'td', label: 'TD', mobileLabel: 'Touchdowns', format: 'integer' },
  { key: 'yards_per_rec', label: 'AVG', mobileLabel: 'Yards / reception', format: 'decimal' },
  { key: 'yards_per_game', label: 'Y/G', mobileLabel: 'Yards / game', format: 'decimal' },
] satisfies Array<PlayerLeaderboardColumn & { key: keyof ReceivingStats }>;

export const PLAYER_LEADER_COLUMNS: Record<PlayerLeaderboardCategory, PlayerLeaderboardColumn[]> = {
  passing: passingColumns,
  rushing: rushingColumns,
  receiving: receivingColumns,
};

export const DEFAULT_PLAYER_LEADER_SORT: Record<PlayerLeaderboardCategory, PlayerLeaderboardStatKey> = {
  passing: 'adjusted_pass_yards_per_attempt',
  rushing: 'yards_per_game',
  receiving: 'yards_per_game',
};

export const CATEGORY_LABELS: Record<PlayerLeaderboardCategory, string> = {
  passing: 'Passing',
  rushing: 'Rushing',
  receiving: 'Receiving',
};

export const formatPlayerLeaderboardStat = (value: number, column: PlayerLeaderboardColumn) => {
  if (column.format === 'percent') return `${value.toFixed(1)}%`;
  if (column.format === 'integer') return value.toLocaleString();
  return value.toFixed(1);
};
