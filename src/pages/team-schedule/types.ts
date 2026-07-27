import type { TeamSchedulePageData } from '../../types/pages';

export type TeamScheduleGame = TeamSchedulePageData['schedule'][number];

export type ScheduleViewProps = {
  games: TeamScheduleGame[];
  seasonYear: number;
  onOpponentClick: (teamName: string) => void;
};
