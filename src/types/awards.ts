export type AwardMode = 'live' | 'final';
export type AwardGroup = 'overall' | 'offense' | 'defense' | 'specialTeams';
export type AwardPlacementKey = 'first' | 'second' | 'third';

export interface AwardDisplayPlayer {
  id: number;
  first: string;
  last: string;
  position: string;
  teamName: string;
}

export interface AwardDisplayPlacement {
  key: AwardPlacementKey;
  player: AwardDisplayPlayer | null;
  score: number | null;
  statLine: string | null;
}

export interface AwardDisplayEntry {
  categorySlug: string;
  categoryName: string;
  categoryDescription: string;
  group: AwardGroup;
  placements: AwardDisplayPlacement[];
}

export interface AwardsResult {
  live: AwardDisplayEntry[];
  final: AwardDisplayEntry[];
}
