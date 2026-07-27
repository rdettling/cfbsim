import type { AwardEntry, AwardPlayer, AwardStats } from '../../types/awards';

export type AwardMode = 'live' | 'final';
export type AwardSelectionHandler = (slug: string) => void;
export type TeamSelectionHandler = (teamName: string) => void;

export type {
  AwardEntry,
  AwardPlayer,
  AwardStats,
};
