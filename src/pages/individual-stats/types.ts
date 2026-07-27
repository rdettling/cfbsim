import type { SortDirection } from '../../types/stats';
import type { IndividualStatColumn } from './config';

export type IndividualDisplayRow = {
  id: number;
  first: string;
  last: string;
  pos: string;
  team: string;
  gamesPlayed: number;
  stats: Record<string, number>;
  rank: number;
};

export type IndividualStatsViewProps = {
  rows: IndividualDisplayRow[];
  columns: IndividualStatColumn[];
  sortKey: string;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  onTeamClick: (teamName: string) => void;
};
