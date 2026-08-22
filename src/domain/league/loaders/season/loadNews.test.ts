import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../../db/db';
import {
  buildTestLeague,
  buildTestTeam,
  TEST_BETTING_ODDS_DATA,
} from '../../../../test/fixtures';
import type {
  GameNewsItem,
  PreviewNewsItem,
  PreviewStoryAngle,
  RankingNewsItem,
} from '../../../../types/news';
import { loadDashboard } from './loadDashboard';
import { loadNews } from './loadNews';
import { loadStandings } from '../standings';

const story = (
  gameId: number,
  year: number,
  week: number,
  importance: number,
): GameNewsItem => ({
  id: `game:${gameId}`,
  type: 'game',
  year,
  week,
  gameId,
  teamIds: [1, 2],
  featuredPlayerId: null,
  headline: `Story ${gameId}`,
  deck: `Deck ${gameId}.`,
  primaryAngle: 'routine_result',
  storylines: ['routine_result'],
  importance,
});

const rankingStory = (year: number, week: number, importance: number): RankingNewsItem => ({
  id: `rankings:${year}:${week}`,
  type: 'rankings',
  year,
  week,
  featuredTeamIds: [1],
  headline: 'Test State takes over at No. 1',
  deck: 'Test State leads the latest Top 25.',
  primaryAngle: 'new_number_one',
  storylines: ['new_number_one'],
  importance,
});

const previewStory = (
  angle: PreviewStoryAngle,
  importance: number,
): PreviewNewsItem => ({
  id: `preview:2026:${angle}`,
  type: 'preview',
  year: 2026,
  week: 0,
  featuredTeamIds: angle === 'marquee_opener' ? [1, 2] : [1],
  featuredGameId: angle === 'marquee_opener' ? 99 : null,
  headline: `Preview ${angle}`,
  deck: `Preview deck ${angle}.`,
  primaryAngle: angle,
  storylines: [angle],
  importance,
});

describe('league news loaders', () => {
  beforeEach(async () => {
    const db = await getDb();
    const tx = db.transaction(['league', 'games', 'newsItems'], 'readwrite');
    await Promise.all([
      tx.objectStore('league').clear(),
      tx.objectStore('games').clear(),
      tx.objectStore('newsItems').clear(),
    ]);
    await tx.done;
    await db.put('baseData', {
      key: 'betting_odds',
      value: TEST_BETTING_ODDS_DATA,
    });
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('season', {
        info: {
          currentWeek: 4,
          lastRankingsWeek: 3,
          currentYear: 2026,
          startYear: 2025,
          stage: 'season',
          team: 'Test State',
          lastWeek: 18,
        },
      }),
    });
  });

  it('groups the selected archive season by newest week and importance', async () => {
    const db = await getDb();
    await db.put('newsItems', story(1, 2025, 2, 10));
    await db.put('newsItems', story(2, 2025, 2, 20));
    await db.put('newsItems', story(3, 2025, 1, 50));

    const result = await loadNews(2025);
    expect(result.availableYears).toEqual([2026, 2025]);
    expect(result.weeks.map(group => group.week)).toEqual([2, 1]);
    expect(result.weeks[0].stories.map(item => item.type === 'game' ? item.gameId : -1))
      .toEqual([2, 1]);
  });

  it('returns only the five most important national stories for the previous week', async () => {
    const db = await getDb();
    for (let index = 1; index <= 7; index += 1) {
      await db.put('newsItems', story(index, 2026, 3, index));
    }
    await db.put('newsItems', rankingStory(2026, 3, 8));
    const result = await loadDashboard();
    expect(result.topStories.map(item => item.type === 'game' ? item.gameId : item.id))
      .toEqual(['rankings:2026:3', 7, 6, 5, 4]);
  });

  it('shows preseason coverage alongside early Week 1 results', async () => {
    const db = await getDb();
    const league = buildTestLeague('season', {
      info: {
        currentWeek: 1,
        lastRankingsWeek: 0,
        currentYear: 2026,
        startYear: 2026,
        stage: 'season',
        team: 'Test State',
        lastWeek: 18,
      },
    });
    await db.put('league', { key: 'current', value: league });
    await db.put('newsItems', previewStory('preseason_poll', 30));
    await db.put('newsItems', previewStory('national_outlook', 28));
    await db.put('newsItems', story(10, 2026, 1, 35));

    expect((await loadDashboard()).topStories.map(item => item.id)).toEqual([
      'game:10',
      'preview:2026:preseason_poll',
      'preview:2026:national_outlook',
    ]);
  });

  it('uses the same conference ordering as the standings page', async () => {
    const db = await getDb();
    const teams = [
      buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP', ranking: 3 }),
      buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET', ranking: 1 }),
      buildTestTeam({ id: 3, name: 'Gamma', abbreviation: 'GAM', ranking: 2 }),
    ];
    const league = buildTestLeague('season', {
      info: {
        currentWeek: 4,
        lastRankingsWeek: 3,
        currentYear: 2026,
        startYear: 2026,
        stage: 'season',
        team: 'Alpha',
        lastWeek: 18,
      },
      teams,
      conferences: [{
        id: 1,
        confName: 'Test Conference',
        confFullName: 'Test Conference',
        confGames: 8,
        info: '',
        championship: null,
        finalStandings: null,
        teams,
      }],
    });
    await db.put('league', { key: 'current', value: league });

    const [dashboard, standings] = await Promise.all([
      loadDashboard(),
      loadStandings('Test Conference'),
    ]);

    expect(dashboard.confTeams.map(team => team.id))
      .toEqual(standings.teams.map(team => team.id));
  });
});
