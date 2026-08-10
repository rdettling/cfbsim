import type {
  SortDirection,
  TeamAggregateStatKey,
  TeamAggregateStats,
} from '../../types/stats';

export type RankedTeamAggregateStatsRow = {
  teamName: string;
  stats: TeamAggregateStats;
  rank: number;
};

export type TeamRankingsViewProps = {
  rows: RankedTeamAggregateStatsRow[];
  averages: TeamAggregateStats;
  sortKey: TeamAggregateStatKey;
  sortDirection: SortDirection;
  onSort: (key: TeamAggregateStatKey) => void;
  onTeamClick: (teamName: string) => void;
};
