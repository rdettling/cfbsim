import type { NonConPageData } from '../../types/pages';
import type { ScheduleNonConGameInput } from '../../types/league';

export type NonConScheduleGame = NonConPageData['schedule'][number];
export type PendingRivalry = NonConPageData['pending_rivalries'][number];
export type NonConSection = 'schedule' | 'rivalries';
export type TeamSelectionHandler = (teamName: string) => void;
export type OpponentScheduleRequest = Omit<ScheduleNonConGameInput, 'week'>;
