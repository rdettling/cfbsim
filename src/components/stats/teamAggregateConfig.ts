import type {
  TeamAggregateStatKey,
  TeamAggregateStats,
} from '../../types/stats';

export type TeamStatGroup =
  | 'General'
  | 'Passing'
  | 'Rushing'
  | 'Total Offense'
  | 'First Downs'
  | 'Turnovers';

export type TeamStatColumn = {
  key: TeamAggregateStatKey;
  label: string;
  mobileLabel: string;
  group: TeamStatGroup;
  width: number;
};

export const TEAM_STAT_COLUMNS: TeamStatColumn[] = [
  { key: 'games', label: 'G', mobileLabel: 'Games', group: 'General', width: 64 },
  { key: 'ppg', label: 'PPG', mobileLabel: 'Points / game', group: 'General', width: 72 },
  { key: 'pass_cpg', label: 'CMP', mobileLabel: 'Completions / game', group: 'Passing', width: 72 },
  { key: 'pass_apg', label: 'ATT', mobileLabel: 'Attempts / game', group: 'Passing', width: 72 },
  { key: 'comp_percent', label: 'PCT', mobileLabel: 'Completion %', group: 'Passing', width: 72 },
  { key: 'pass_ypg', label: 'YDS', mobileLabel: 'Passing yards / game', group: 'Passing', width: 76 },
  { key: 'pass_tdpg', label: 'TD', mobileLabel: 'Passing TD / game', group: 'Passing', width: 68 },
  { key: 'rush_apg', label: 'ATT', mobileLabel: 'Attempts / game', group: 'Rushing', width: 72 },
  { key: 'rush_ypg', label: 'YDS', mobileLabel: 'Rushing yards / game', group: 'Rushing', width: 76 },
  { key: 'rush_ypc', label: 'AVG', mobileLabel: 'Yards / carry', group: 'Rushing', width: 72 },
  { key: 'rush_tdpg', label: 'TD', mobileLabel: 'Rushing TD / game', group: 'Rushing', width: 68 },
  { key: 'playspg', label: 'Plays', mobileLabel: 'Plays / game', group: 'Total Offense', width: 76 },
  { key: 'yardspg', label: 'YDS', mobileLabel: 'Yards / game', group: 'Total Offense', width: 76 },
  { key: 'ypp', label: 'AVG', mobileLabel: 'Yards / play', group: 'Total Offense', width: 72 },
  { key: 'first_downs_pass', label: 'Pass', mobileLabel: 'Passing first downs', group: 'First Downs', width: 72 },
  { key: 'first_downs_rush', label: 'Rush', mobileLabel: 'Rushing first downs', group: 'First Downs', width: 72 },
  { key: 'first_downs_total', label: 'Total', mobileLabel: 'Total first downs', group: 'First Downs', width: 72 },
  { key: 'fumbles', label: 'FUM', mobileLabel: 'Fumbles', group: 'Turnovers', width: 72 },
  { key: 'interceptions', label: 'INT', mobileLabel: 'Interceptions', group: 'Turnovers', width: 72 },
  { key: 'turnovers', label: 'TO', mobileLabel: 'Total turnovers', group: 'Turnovers', width: 72 },
];

export const TEAM_STAT_GROUPS: TeamStatGroup[] = [
  'General',
  'Passing',
  'Rushing',
  'Total Offense',
  'First Downs',
  'Turnovers',
];

export const getTeamStatColumn = (key: TeamAggregateStatKey) =>
  TEAM_STAT_COLUMNS.find(column => column.key === key) ?? TEAM_STAT_COLUMNS[1];

export const formatTeamStat = (stats: TeamAggregateStats, key: TeamAggregateStatKey) => {
  const value = stats[key];
  if (key === 'comp_percent') return `${value.toFixed(1)}%`;
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
};
