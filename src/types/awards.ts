export interface AwardPlayer {
  id: number;
  first: string;
  last: string;
  pos: string;
  rating: number;
  stars: number;
  team_name: string;
}

export interface AwardStats {
  stat_line?: string;
  [key: string]: unknown;
}

export interface AwardEntry {
  category_slug: string;
  category_name: string;
  category_description: string;
  is_final: boolean;
  last_updated: string;
  first_place: AwardPlayer | null;
  first_score: number | null;
  first_stats: AwardStats | null;
  second_place: AwardPlayer | null;
  second_score: number | null;
  second_stats: AwardStats | null;
  third_place: AwardPlayer | null;
  third_score: number | null;
  third_stats: AwardStats | null;
}

export interface AwardsResult {
  favorites: AwardEntry[];
  final: AwardEntry[];
}
