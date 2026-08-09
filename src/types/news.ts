export const GAME_TYPES = [
  'regular_season',
  'conference_championship',
  'bowl',
  'playoff_first_round',
  'playoff_quarterfinal',
  'playoff_semifinal',
  'national_championship',
] as const;

export type GameType = (typeof GAME_TYPES)[number];

export const GAME_STORY_ANGLES = [
  'championship',
  'playoff_advance',
  'bowl_result',
  'upset',
  'comeback',
  'late_decider',
  'overtime',
  'rivalry',
  'standout_player',
  'defensive_dominance',
  'blowout',
  'ranked_result',
  'routine_result',
] as const;

export type GameStoryAngle = (typeof GAME_STORY_ANGLES)[number];

export interface NewsItemCore {
  year: number;
  week: number;
  headline: string;
  deck: string;
  importance: number;
}

export interface GameNewsItem extends NewsItemCore {
  id: `game:${number}`;
  type: 'game';
  gameId: number;
  teamIds: [number, number];
  featuredPlayerId: number | null;
  primaryAngle: GameStoryAngle;
  storylines: GameStoryAngle[];
}

export const RANKING_STORY_ANGLES = [
  'new_number_one',
  'top_five_shakeup',
  'top_25_turnover',
  'playoff_field',
] as const;

export type RankingStoryAngle = (typeof RANKING_STORY_ANGLES)[number];

export interface RankingNewsItem extends NewsItemCore {
  id: `rankings:${number}:${number}`;
  type: 'rankings';
  featuredTeamIds: number[];
  primaryAngle: RankingStoryAngle;
  storylines: RankingStoryAngle[];
}

export const PREVIEW_STORY_ANGLES = [
  'preseason_poll',
  'national_outlook',
  'marquee_opener',
] as const;

export type PreviewStoryAngle = (typeof PREVIEW_STORY_ANGLES)[number];

export interface PreviewNewsItem extends NewsItemCore {
  id: `preview:${number}:${PreviewStoryAngle}`;
  type: 'preview';
  featuredTeamIds: number[];
  featuredGameId: number | null;
  primaryAngle: PreviewStoryAngle;
  storylines: PreviewStoryAngle[];
}

export type NewsItem = GameNewsItem | RankingNewsItem | PreviewNewsItem;
