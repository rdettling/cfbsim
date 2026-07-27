import type { RankingsPageData } from '../../types/pages';

export type RankedTeam = RankingsPageData['rankings'][number];

export type RankingsViewProps = {
  teams: RankedTeam[];
  onTeamClick: (name: string) => void;
};
