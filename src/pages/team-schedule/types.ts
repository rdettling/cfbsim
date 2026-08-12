import type {
  TeamScheduleGameRow,
  TeamScheduleRow,
} from '../../types/scheduleTypes';

export type TeamScheduleGame = TeamScheduleGameRow;

export type ScheduleViewProps = {
  games: TeamScheduleRow[];
  seasonYear: number;
  onOpponentClick: (teamName: string) => void;
};
