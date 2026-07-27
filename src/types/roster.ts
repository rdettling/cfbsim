import type { PlayerRecord } from './db';

export interface Recruit {
  rid?: number;
  first: string;
  last: string;
  pos: string;
  stars: number;
  state: string;
  rating_fr: number;
  rating_so: number;
  rating_jr: number;
  rating_sr: number;
  development_trait: number;
}

export type PlayerProgressionProjection =
  | {
      status: 'returning';
      projectedClass: PlayerRecord['year'];
      projectedRating: number;
    }
  | {
      status: 'departing';
    };

export interface ReturningPlayerPreview {
  id: number;
  first: string;
  last: string;
  position: string;
  currentClass: PlayerRecord['year'];
  projectedClass: PlayerRecord['year'];
  currentRating: number;
  projectedRating: number;
  ratingChange: number;
}

export interface DepartingPlayerPreview {
  id: number;
  first: string;
  last: string;
  position: string;
  currentClass: 'sr';
  currentRating: number;
}

export interface RosterProgressionSummary {
  returningPlayers: number;
  departingSeniors: number;
  averageRatingChange: number;
  maximumRatingChange: number;
}

export interface RosterCutPlayerPreview {
  id: number;
  first: string;
  last: string;
  position: string;
  currentClass: PlayerRecord['year'];
  currentRating: number;
  seniorRating: number;
}

export interface RosterPositionCutPreview {
  position: string;
  activePlayers: number;
  rosterLimit: number;
  projectedCuts: number;
  projectedPlayers: number;
}

export interface RosterCutsSummary {
  activePlayers: number;
  projectedCuts: number;
  projectedRosterSize: number;
  positionsOverLimit: number;
}

export interface RosterCutsPreview {
  cuts: RosterCutPlayerPreview[];
  positions: RosterPositionCutPreview[];
  summary: RosterCutsSummary;
}
