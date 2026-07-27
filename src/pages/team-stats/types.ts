import type {
  SortDirection,
  TeamStatKey,
  TeamStats,
} from '../../types/stats';

export type RankedTeamStats = {
  teamName: string;
  stats: TeamStats;
  rank: number;
};

export type TeamStatsViewProps = {
  rows: RankedTeamStats[];
  averages: TeamStats;
  sortKey: TeamStatKey;
  sortDirection: SortDirection;
  onSort: (key: TeamStatKey) => void;
  onTeamClick: (teamName: string) => void;
};
