import type {
  SortDirection,
  TeamPlayerStatKey,
  TeamPlayerStatValues,
} from '../../types/stats';
import type { TeamPlayerStatColumn } from './config';

export type TeamPlayerDisplayRow = {
  id: number;
  first: string;
  last: string;
  pos: string;
  stats: TeamPlayerStatValues;
};

export type TeamPlayerStatsViewProps = {
  rows: TeamPlayerDisplayRow[];
  columns: TeamPlayerStatColumn[];
  sortKey: TeamPlayerStatKey;
  sortDirection: SortDirection;
  onSort: (key: TeamPlayerStatKey) => void;
};
