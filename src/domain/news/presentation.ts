import { ROUTES } from '../../constants/routes';
import type { GameStoryAngle, NewsItem } from '../../types/news';

const GAME_ANGLE_LABELS: Record<GameStoryAngle, string> = {
  championship: 'Championship',
  playoff_advance: 'Playoff',
  bowl_result: 'Bowl result',
  upset: 'Upset',
  comeback: 'Comeback',
  late_decider: 'Late finish',
  overtime: 'Overtime',
  rivalry: 'Rivalry',
  standout_player: 'Standout',
  defensive_dominance: 'Defense',
  blowout: 'Statement win',
  ranked_result: 'Ranked result',
  routine_result: 'Final',
};

export const storyKicker = (story: NewsItem): string => {
  switch (story.type) {
    case 'game':
      return GAME_ANGLE_LABELS[story.primaryAngle];
    case 'rankings':
      return story.primaryAngle === 'playoff_field' ? 'Playoff field' : 'Rankings';
    case 'preview':
      switch (story.primaryAngle) {
        case 'preseason_poll': return 'Preseason poll';
        case 'national_outlook': return 'National outlook';
        case 'marquee_opener': return 'Week 1 spotlight';
      }
  }
};

export const storyRoute = (story: NewsItem): string => {
  switch (story.type) {
    case 'game':
      return `/game/${story.gameId}`;
    case 'rankings':
      return story.primaryAngle === 'playoff_field' ? ROUTES.PLAYOFF : ROUTES.RANKINGS;
    case 'preview':
      switch (story.primaryAngle) {
        case 'preseason_poll':
          return ROUTES.RANKINGS;
        case 'national_outlook':
          return ROUTES.PLAYOFF_PICTURE;
        case 'marquee_opener':
          if (story.featuredGameId === null) {
            throw new Error('A marquee opener requires a game.');
          }
          return `/game/${story.featuredGameId}`;
      }
  }
};
