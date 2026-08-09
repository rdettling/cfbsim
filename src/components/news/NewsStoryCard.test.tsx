import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { PreviewNewsItem, RankingNewsItem } from '../../types/news';
import { storyKicker, storyRoute } from '../../domain/news/presentation';
import { NewsStoryCard } from './NewsStoryCard';

const story: RankingNewsItem = {
  id: 'rankings:2026:15',
  type: 'rankings',
  year: 2026,
  week: 15,
  featuredTeamIds: [1, 2, 3, 4],
  headline: 'Playoff set: Test State earns the top seed',
  deck: 'The final four-team field is set.',
  primaryAngle: 'playoff_field',
  storylines: ['playoff_field'],
  importance: 92,
};

describe('NewsStoryCard', () => {
  it('links playoff-field stories to the bracket', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter><NewsStoryCard story={story} /></MemoryRouter>,
    );
    expect(storyKicker(story)).toBe('Playoff field');
    expect(storyRoute(story)).toBe('/playoff');
    expect(markup).toContain('Playoff field');
    expect(markup).toContain(story.headline);
    expect(markup).toContain('href="/playoff"');
  });

  it('links weekly poll stories to the Top 25 page', () => {
    const rankingsStory: RankingNewsItem = {
      ...story,
      id: 'rankings:2026:8',
      week: 8,
      primaryAngle: 'new_number_one',
      storylines: ['new_number_one'],
    };
    const markup = renderToStaticMarkup(
      <MemoryRouter><NewsStoryCard story={rankingsStory} /></MemoryRouter>,
    );
    expect(storyRoute(rankingsStory)).toBe('/rankings');
    expect(markup).toContain('href="/rankings"');
  });

  it('links each preseason angle to its relevant destination', () => {
    const preview: PreviewNewsItem = {
      id: 'preview:2027:preseason_poll',
      type: 'preview',
      year: 2027,
      week: 0,
      featuredTeamIds: [1, 2, 3, 4, 5],
      featuredGameId: null,
      headline: 'Team 1 leads the preseason Top 25',
      deck: 'The first poll is set.',
      primaryAngle: 'preseason_poll',
      storylines: ['preseason_poll'],
      importance: 30,
    };
    expect(storyRoute(preview)).toBe('/rankings');
    expect(storyRoute({
      ...preview,
      id: 'preview:2027:national_outlook',
      primaryAngle: 'national_outlook',
      storylines: ['national_outlook'],
    })).toBe('/playoff/picture');
    expect(storyRoute({
      ...preview,
      id: 'preview:2027:marquee_opener',
      primaryAngle: 'marquee_opener',
      storylines: ['marquee_opener'],
      featuredTeamIds: [1, 2],
      featuredGameId: 44,
    })).toBe('/game/44');
  });
});
