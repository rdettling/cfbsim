import type {
  PlayerLeaderboardStatKey,
  PlayerLeaderboardStatValues,
  SortDirection,
} from '../../types/stats';
import type { PlayerLeaderboardColumn } from './config';

export type PlayerLeaderboardDisplayRow = {
  id: number;
  first: string;
  last: string;
  pos: string;
  team: string;
  gamesPlayed: number;
  stats: PlayerLeaderboardStatValues;
  rank: number;
};

export type PlayerLeadersViewProps = {
  rows: PlayerLeaderboardDisplayRow[];
  columns: PlayerLeaderboardColumn[];
  sortKey: PlayerLeaderboardStatKey;
  sortDirection: SortDirection;
  onSort: (key: PlayerLeaderboardStatKey) => void;
  onTeamClick: (teamName: string) => void;
};
