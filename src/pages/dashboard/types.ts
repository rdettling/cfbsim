import type { DashboardPageData } from '../../types/pages';

export type DashboardGame = NonNullable<
  DashboardPageData['prev_game'] | DashboardPageData['curr_game']
>;

export type DashboardTeam = DashboardPageData['confTeams'][number];
export type DashboardStory = DashboardPageData['topStories'][number];

export type DashboardTeamClickHandler = (name: string) => void;
