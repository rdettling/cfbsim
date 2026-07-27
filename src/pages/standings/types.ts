import type { StandingsPageData } from '../../types/pages';

export type StandingTeam = StandingsPageData['teams'][number];

export type StandingsViewProps = {
  teams: StandingTeam[];
  isIndependent: boolean;
  onTeamClick: (name: string) => void;
};
