import type {
  IndividualStatsCategory,
  PassingStats,
  ReceivingStats,
  RushingStats,
} from '../../types/stats';

export type IndividualStatColumn = {
  key: string;
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
] satisfies Array<IndividualStatColumn & { key: keyof PassingStats }>;

const rushingColumns = [
  { key: 'att', label: 'ATT', mobileLabel: 'Attempts', format: 'integer' },
  { key: 'yards', label: 'YDS', mobileLabel: 'Rushing yards', format: 'integer' },
  { key: 'td', label: 'TD', mobileLabel: 'Touchdowns', format: 'integer' },
  { key: 'fumbles', label: 'FUM', mobileLabel: 'Fumbles', format: 'integer' },
  { key: 'yards_per_rush', label: 'AVG', mobileLabel: 'Yards / carry', format: 'decimal' },
  { key: 'yards_per_game', label: 'Y/G', mobileLabel: 'Yards / game', format: 'decimal' },
] satisfies Array<IndividualStatColumn & { key: keyof RushingStats }>;

const receivingColumns = [
  { key: 'rec', label: 'REC', mobileLabel: 'Receptions', format: 'integer' },
  { key: 'yards', label: 'YDS', mobileLabel: 'Receiving yards', format: 'integer' },
  { key: 'td', label: 'TD', mobileLabel: 'Touchdowns', format: 'integer' },
  { key: 'yards_per_rec', label: 'AVG', mobileLabel: 'Yards / reception', format: 'decimal' },
  { key: 'yards_per_game', label: 'Y/G', mobileLabel: 'Yards / game', format: 'decimal' },
] satisfies Array<IndividualStatColumn & { key: keyof ReceivingStats }>;

export const INDIVIDUAL_COLUMNS: Record<IndividualStatsCategory, IndividualStatColumn[]> = {
  passing: passingColumns,
  rushing: rushingColumns,
  receiving: receivingColumns,
};

export const DEFAULT_INDIVIDUAL_SORT: Record<IndividualStatsCategory, string> = {
  passing: 'adjusted_pass_yards_per_attempt',
  rushing: 'yards_per_game',
  receiving: 'yards_per_game',
};

export const CATEGORY_LABELS: Record<IndividualStatsCategory, string> = {
  passing: 'Passing',
  rushing: 'Rushing',
  receiving: 'Receiving',
};

export const formatIndividualStat = (value: number, column: IndividualStatColumn) => {
  if (column.format === 'percent') return `${value.toFixed(1)}%`;
  if (column.format === 'integer') return value.toLocaleString();
  return value.toFixed(1);
};
