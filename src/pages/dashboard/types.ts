import type { DashboardPageData } from '../../types/pages';

export type DashboardGame = NonNullable<
  DashboardPageData['prev_game'] | DashboardPageData['curr_game']
>;

export type DashboardTeam = DashboardPageData['confTeams'][number];
export type DashboardHeadline = DashboardPageData['top_games'][number];

export type DashboardTeamClickHandler = (name: string) => void;
