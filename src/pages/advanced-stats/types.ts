import type { AdvancedTeamStatsRow } from '../../types/stats';
import type {
  AdvancedMetricKey,
  AdvancedSortDirection,
  AdvancedStatsMode,
} from './config';

export type AdvancedStatsViewProps = {
  rows: AdvancedTeamStatsRow[];
  mode: AdvancedStatsMode;
  sortKey: AdvancedMetricKey;
  sortDirection: AdvancedSortDirection;
  onSort: (key: AdvancedMetricKey) => void;
  onTeamClick: (teamName: string) => void;
};
