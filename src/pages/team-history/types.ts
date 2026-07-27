import type { TeamHistoryPageData } from '../../types/pages';

export type TeamHistoryYear = TeamHistoryPageData['years'][number];

export type TeamHistoryViewProps = {
  years: TeamHistoryYear[];
  teamName: string;
};

export const rankLabel = (rank: number) => rank > 0 ? `#${rank}` : 'Unranked';
