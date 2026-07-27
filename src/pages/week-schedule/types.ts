import type { WeekSchedulePageData } from '../../types/pages';

export type WeekScheduleGame = WeekSchedulePageData['games'][number];

export type WeekScheduleGameCardProps = {
  game: WeekScheduleGame;
  onTeamClick: (name: string) => void;
};
