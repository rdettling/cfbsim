import type { AdvancedTeamStatsRow, AdvancedUnitStats } from '../../types/stats';

export type AdvancedStatsMode = 'performance' | 'poll' | 'offense' | 'defense';
const ADVANCED_INDEX_KEYS = [
  'pollRank',
  'pollScore',
  'teamRatingPriorWeight',
  'teamScore',
  'evidenceScore',
  'resumeScore',
  'performanceIndex',
  'offensePerformance',
  'defensePerformance',
  'teamRating',
] as const;
type AdvancedIndexMetric = typeof ADVANCED_INDEX_KEYS[number];
export type AdvancedMetricKey = AdvancedIndexMetric | keyof AdvancedUnitStats;
export type AdvancedSortDirection = 'asc' | 'desc';

export const ADVANCED_STATS_MODES = [
  { value: 'performance', label: 'Performance' },
  { value: 'poll', label: 'Poll' },
  { value: 'offense', label: 'Offense' },
  { value: 'defense', label: 'Defense' },
] as const satisfies ReadonlyArray<{
  value: AdvancedStatsMode;
  label: string;
}>;

export const DEFAULT_ADVANCED_STATS_MODE: AdvancedStatsMode = 'performance';

type AdvancedMetricColumn = {
  key: AdvancedMetricKey;
  label: string;
  mobileLabel: string;
  description: string;
  width: number;
  direction: AdvancedSortDirection;
};

const indexColumns: Record<AdvancedIndexMetric, AdvancedMetricColumn> = {
  pollRank: {
    key: 'pollRank',
    label: 'Poll Rank',
    mobileLabel: 'Official Poll Order',
    description: 'The team’s official published rank. Postseason rules can override Poll Score order.',
    width: 76,
    direction: 'asc',
  },
  pollScore: {
    key: 'pollScore',
    label: 'Poll Score',
    mobileLabel: 'Poll Score',
    description: 'The published 0–100 score underlying the official poll.',
    width: 96,
    direction: 'desc',
  },
  teamRatingPriorWeight: {
    key: 'teamRatingPriorWeight',
    label: 'Rating Prior',
    mobileLabel: 'Team Rating Prior',
    description: 'The share of projected Poll Score supplied by Team Score; it reaches zero after eight games.',
    width: 104,
    direction: 'desc',
  },
  teamScore: {
    key: 'teamScore',
    label: 'Team Score',
    mobileLabel: 'Team Score',
    description: 'Team Rating mapped from its fixed 25–99 scale onto the poll’s 0–100 scale.',
    width: 96,
    direction: 'desc',
  },
  performanceIndex: {
    key: 'performanceIndex',
    label: 'Performance',
    mobileLabel: 'Performance Index',
    description: 'Completed-game offense and defense adjusted only for opponents’ Team Ratings.',
    width: 92,
    direction: 'desc',
  },
  offensePerformance: {
    key: 'offensePerformance',
    label: 'Offense',
    mobileLabel: 'Offense Performance',
    description: 'Completed-game offensive performance adjusted for opponents’ Team Ratings.',
    width: 96,
    direction: 'desc',
  },
  defensePerformance: {
    key: 'defensePerformance',
    label: 'Defense',
    mobileLabel: 'Defense Performance',
    description: 'Completed-game defensive performance adjusted for opponents’ Team Ratings. Higher is better.',
    width: 96,
    direction: 'desc',
  },
  teamRating: {
    key: 'teamRating',
    label: 'Team Rating',
    mobileLabel: 'Team Rating',
    description: 'Forward-looking player-based rating used by the game simulation. It is not part of Performance Index.',
    width: 92,
    direction: 'desc',
  },
  resumeScore: {
    key: 'resumeScore',
    label: 'Résumé',
    mobileLabel: 'Résumé Score',
    description: 'Record and wins over expectation on a fixed 0–100 scale; play efficiency and margin are excluded.',
    width: 92,
    direction: 'desc',
  },
  evidenceScore: {
    key: 'evidenceScore',
    label: 'Evidence',
    mobileLabel: 'Evidence Score',
    description: 'The late-season poll basis: approximately 72.2% Résumé Score and 27.8% Performance Index.',
    width: 92,
    direction: 'desc',
  },
};

const unitColumn = (
  key: keyof AdvancedUnitStats,
  label: string,
  mobileLabel: string,
  description: string,
  direction: AdvancedSortDirection,
  width = 108,
): AdvancedMetricColumn => ({ key, label, mobileLabel, description, direction, width });

const offenseColumns: AdvancedMetricColumn[] = [
  indexColumns.offensePerformance,
  unitColumn('successRate', 'Success', 'Success Rate', 'Plays gaining 50% of needed yards on first down, 70% on second, and 100% on third or fourth.', 'desc'),
  unitColumn('standardDownSuccessRate', 'Std. Success', 'Standard Down Success', 'Success rate on first downs, second-and-7 or fewer, and third/fourth-and-4 or fewer.', 'desc', 122),
  unitColumn('passingDownSuccessRate', 'Pass Down', 'Passing Down Success', 'Success rate on second-and-8 or more and third/fourth-and-5 or more.', 'desc', 112),
  unitColumn('explosivePlayRate', 'Explosive', 'Explosive Play Rate', 'Share of plays producing a run of at least 10 yards or pass of at least 20 yards.', 'desc'),
  unitColumn('successfulPlayYards', 'Success Yds', 'Successful-Play Yards', 'Average yards gained on successful plays, separating explosiveness from success frequency.', 'desc'),
  unitColumn('pointsPerOpportunity', 'Pts/Opp', 'Points per Opportunity', 'Points per drive that reaches the opponent 40-yard line.', 'desc'),
  unitColumn('havocRate', 'Havoc All.', 'Havoc Allowed', 'Share of offensive plays ending in a sack, interception, fumble, or negative run.', 'asc'),
  unitColumn('averageStartingFieldPosition', 'Avg Start', 'Average Start', 'Average offensive drive starting field position on a 0–100 field.', 'desc'),
  unitColumn('lineYardsPerCarry', 'Line Yds', 'Line Yards per Carry', 'Rushing yards assigned to blocking: losses ×1.2, full credit through four, half credit through ten.', 'desc'),
  unitColumn('stuffRate', 'Stuffed', 'Stuff Rate', 'Share of runs stopped at or behind the line of scrimmage.', 'asc'),
];

const defenseColumns: AdvancedMetricColumn[] = [
  indexColumns.defensePerformance,
  unitColumn('successRate', 'Success All.', 'Success Rate Allowed', 'Opponent success rate using the standard down-and-distance thresholds.', 'asc'),
  unitColumn('standardDownSuccessRate', 'Std. All.', 'Standard Down Success Allowed', 'Opponent success rate on standard downs.', 'asc', 112),
  unitColumn('passingDownSuccessRate', 'Pass Down All.', 'Passing Down Success Allowed', 'Opponent success rate on passing downs.', 'asc', 132),
  unitColumn('explosivePlayRate', 'Explosive All.', 'Explosive Rate Allowed', 'Share of opponent plays producing a 10-yard run or 20-yard pass.', 'asc', 126),
  unitColumn('successfulPlayYards', 'Success Yds All.', 'Successful-Play Yards Allowed', 'Average opponent yards on successful plays.', 'asc', 132),
  unitColumn('pointsPerOpportunity', 'Pts/Opp All.', 'Points per Opportunity Allowed', 'Opponent points per drive that reaches the 40-yard line.', 'asc', 126),
  unitColumn('havocRate', 'Havoc', 'Havoc Rate', 'Share of defensive plays producing a sack, interception, fumble, or negative run.', 'desc'),
  unitColumn('averageStartingFieldPosition', 'Opp Start', 'Opponent Average Start', 'Average opponent drive starting field position. Lower is better.', 'asc'),
  unitColumn('lineYardsPerCarry', 'Line Yds All.', 'Line Yards Allowed', 'Blocking-adjusted rushing yards allowed per carry.', 'asc', 116),
  unitColumn('stuffRate', 'Stuff Rate', 'Defensive Stuff Rate', 'Share of opponent runs stopped at or behind the line.', 'desc'),
];

export const ADVANCED_METRIC_COLUMNS: Record<AdvancedStatsMode, AdvancedMetricColumn[]> = {
  performance: [
    indexColumns.performanceIndex,
    indexColumns.offensePerformance,
    indexColumns.defensePerformance,
    indexColumns.teamRating,
  ],
  poll: [
    indexColumns.pollScore,
    indexColumns.teamRatingPriorWeight,
    indexColumns.teamScore,
    indexColumns.evidenceScore,
    indexColumns.resumeScore,
    indexColumns.performanceIndex,
  ],
  offense: offenseColumns,
  defense: defenseColumns,
};

export const ADVANCED_SORT_COLUMNS: Record<AdvancedStatsMode, AdvancedMetricColumn[]> = {
  ...ADVANCED_METRIC_COLUMNS,
  poll: [indexColumns.pollRank, ...ADVANCED_METRIC_COLUMNS.poll],
};

export const DEFAULT_ADVANCED_METRIC: Record<AdvancedStatsMode, AdvancedMetricKey> = {
  performance: 'performanceIndex',
  poll: 'pollRank',
  offense: 'offensePerformance',
  defense: 'defensePerformance',
};

const indexKeys = new Set<AdvancedMetricKey>(ADVANCED_INDEX_KEYS);

export const getAdvancedMetricValue = (
  row: AdvancedTeamStatsRow,
  mode: AdvancedStatsMode,
  key: AdvancedMetricKey,
) => indexKeys.has(key)
  ? row[key as AdvancedIndexMetric]
  : row[mode === 'defense' ? 'defense' : 'offense'][key as keyof AdvancedUnitStats];

export const formatAdvancedMetric = (
  row: AdvancedTeamStatsRow,
  mode: AdvancedStatsMode,
  key: AdvancedMetricKey,
) => {
  const value = getAdvancedMetricValue(row, mode, key);
  if (
    row.games === 0 &&
    key !== 'pollRank' &&
    key !== 'pollScore' &&
    key !== 'teamRatingPriorWeight' &&
    key !== 'teamScore' &&
    key !== 'teamRating'
  ) {
    return '—';
  }
  if (key === 'pollRank') return value.toFixed(0);
  if (key === 'teamRatingPriorWeight') {
    return `${(value * 100).toFixed(0)}%`;
  }
  if (
    key === 'successRate' ||
    key === 'standardDownSuccessRate' ||
    key === 'passingDownSuccessRate' ||
    key === 'explosivePlayRate' ||
    key === 'havocRate' ||
    key === 'stuffRate'
  ) return `${(value * 100).toFixed(1)}%`;
  if (key === 'pointsPerOpportunity' || key === 'lineYardsPerCarry') {
    return value.toFixed(2);
  }
  return value.toFixed(1);
};

export const sortAdvancedStatsRows = (
  rows: AdvancedTeamStatsRow[],
  mode: AdvancedStatsMode,
  key: AdvancedMetricKey,
  direction: AdvancedSortDirection,
) => [...rows].sort((left, right) => {
  const difference = getAdvancedMetricValue(left, mode, key) -
    getAdvancedMetricValue(right, mode, key);
  return (direction === 'asc' ? difference : -difference) ||
    left.teamId - right.teamId;
});
