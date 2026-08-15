import type { LeagueRecordsSortDirection, LeagueRecordsSortKey } from './config';
import type { RankedLeagueRecordProgram } from './sorting';

export interface LeagueRecordsViewProps {
  rows: RankedLeagueRecordProgram[];
  sortKey: LeagueRecordsSortKey;
  sortDirection: LeagueRecordsSortDirection;
  onSort: (key: LeagueRecordsSortKey) => void;
  onTeamClick: (name: string) => void;
}
