import type { RankingsPageData } from '../../types/pages';

export type RankedTeam = RankingsPageData['rankings'][number];

export type RankingsViewProps = {
  teams: RankedTeam[];
  hasUpcomingGames: boolean;
  onTeamClick: (name: string) => void;
};
