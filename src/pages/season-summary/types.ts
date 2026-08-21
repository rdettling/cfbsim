import type { SeasonSummaryPageData } from '../../types/pages';

export type SeasonSummaryChampionship = NonNullable<SeasonSummaryPageData['championship']>;
export type SeasonSummaryAward = SeasonSummaryPageData['awards'][number];
export type SeasonSummaryTeam = SeasonSummaryPageData['teams'][number];
export type SeasonSummaryLegacy = NonNullable<SeasonSummaryPageData['legacy']>;
export type SeasonSummaryDetail = 'awards' | 'prestige';
export type TeamSelectionHandler = (teamName: string) => void;
