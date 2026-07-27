import type { SeasonSummaryPageData } from '../../types/pages';

export type SeasonSummaryChampion = NonNullable<SeasonSummaryPageData['champion']>;
export type SeasonSummaryAward = SeasonSummaryPageData['awards'][number];
export type SeasonSummaryTeam = SeasonSummaryPageData['teams'][number];
export type SeasonSummaryDetail = 'awards' | 'prestige';
export type TeamSelectionHandler = (teamName: string) => void;
