import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestLeague } from '../test/fixtures';
import type { GameDetailRecord, GameRecord } from '../types/db';
import type { GameNewsItem, PreviewNewsItem, RankingNewsItem } from '../types/news';
import { getDb } from './db';
import {
  getGameNews,
  getNewsByWeek,
  getNewsByYear,
} from './newsRepo';
import { assertNewsIntegrity, NewsDataIntegrityError } from './newsIntegrity';
import { commitSimulationBatch, saveGamesAndLeague } from './simRepo';

const completedGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 4,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: 'Test State vs Other State',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 3,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 0,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  scoreA: 28,
  scoreB: 17,
  watchability: 60,
  ...overrides,
});

const story = (overrides: Partial<GameNewsItem> = {}): GameNewsItem => ({
  id: 'game:4',
  type: 'game',
  year: 2025,
  week: 3,
  gameId: 4,
  teamIds: [1, 2],
  featuredPlayerId: null,
  headline: 'Test State beats Other State 28-17',
  deck: 'Test State secured an 11-point victory.',
  primaryAngle: 'ranked_result',
  storylines: ['ranked_result'],
  importance: 10,
  ...overrides,
});

const rankingStory = (): RankingNewsItem => ({
  id: 'rankings:2025:3',
  type: 'rankings',
  year: 2025,
  week: 3,
  featuredTeamIds: [1, 2],
  headline: 'Test State takes over at No. 1',
  deck: 'Test State replaces Other State atop the poll after Week 3.',
  primaryAngle: 'new_number_one',
  storylines: ['new_number_one'],
  importance: 39,
});

const previewStories = (): PreviewNewsItem[] => [
  {
    id: 'preview:2025:preseason_poll',
    type: 'preview',
    year: 2025,
    week: 0,
    featuredTeamIds: [1, 2],
    featuredGameId: null,
    headline: 'Test State leads the preseason poll',
    deck: 'Test State opens at No. 1.',
    primaryAngle: 'preseason_poll',
    storylines: ['preseason_poll'],
    importance: 30,
  },
  {
    id: 'preview:2025:national_outlook',
    type: 'preview',
    year: 2025,
    week: 0,
    featuredTeamIds: [1, 2],
    featuredGameId: null,
    headline: 'Test State leads the title chase',
    deck: 'The national race begins with Test State.',
    primaryAngle: 'national_outlook',
    storylines: ['national_outlook'],
    importance: 28,
  },
  {
    id: 'preview:2025:marquee_opener',
    type: 'preview',
    year: 2025,
    week: 0,
    featuredTeamIds: [1, 2],
    featuredGameId: 5,
    headline: 'Test State meets Other State in the opener',
    deck: 'The teams meet in Week 1.',
    primaryAngle: 'marquee_opener',
    storylines: ['marquee_opener'],
    importance: 26,
  },
];

describe('news repository', () => {
  beforeEach(async () => {
    const db = await getDb();
    const tx = db.transaction(['league', 'games', 'gameDetails', 'newsItems'], 'readwrite');
    await Promise.all([
      tx.objectStore('league').clear(),
      tx.objectStore('games').clear(),
      tx.objectStore('gameDetails').clear(),
      tx.objectStore('newsItems').clear(),
    ]);
    await tx.done;
  });

  it('queries stable game stories by source, week, and season', async () => {
    const db = await getDb();
    await db.put('newsItems', story());
    expect(await getGameNews(4)).toEqual(story());
    expect(await getNewsByWeek(2025, 3)).toEqual([story()]);
    expect(await getNewsByYear(2025)).toEqual([story()]);
  });

  it('requires exactly one matching story for every completed game', () => {
    expect(() => assertNewsIntegrity([], [completedGame()], new Set())).toThrow(
      NewsDataIntegrityError,
    );
    expect(() => assertNewsIntegrity(
      [story()],
      [{ ...completedGame(), winnerId: null }],
      new Set(),
    )).toThrow(NewsDataIntegrityError);
    expect(() => assertNewsIntegrity([story()], [completedGame()], new Set())).not.toThrow();
  });

  it('stores rankings stories in the mixed feed with a sparse game index', async () => {
    const db = await getDb();
    await db.put('newsItems', rankingStory());
    expect(await getNewsByWeek(2025, 3)).toEqual([rankingStory()]);
    expect(await db.getAllFromIndex('newsItems', 'gameId', 4)).toEqual([]);
    expect(() => assertNewsIntegrity(
      [story(), rankingStory()],
      [completedGame()],
      new Set(),
      new Set([1, 2]),
    )).not.toThrow();
  });

  it('rejects invalid rankings references and playoff field sizes', () => {
    expect(() => assertNewsIntegrity(
      [story(), { ...rankingStory(), featuredTeamIds: [99] }],
      [completedGame()],
      new Set(),
      new Set([1, 2]),
    )).toThrow(NewsDataIntegrityError);
    expect(() => assertNewsIntegrity(
      [story(), {
        ...rankingStory(),
        id: 'rankings:2025:15',
        week: 15,
        primaryAngle: 'playoff_field',
        storylines: ['playoff_field'],
        featuredTeamIds: [1],
      }],
      [completedGame()],
      new Set(),
      new Set([1, 2]),
    )).toThrow(NewsDataIntegrityError);
  });

  it('validates the complete preseason package before and after its matchup', async () => {
    const opener = completedGame({ id: 5, winnerId: null, weekPlayed: 1 });
    expect(() => assertNewsIntegrity(
      [story(), ...previewStories()],
      [completedGame(), opener],
      new Set(),
      new Set([1, 2]),
    )).not.toThrow();
    expect(() => assertNewsIntegrity(
      [story(), ...previewStories().slice(0, 2)],
      [completedGame(), opener],
      new Set(),
      new Set([1, 2]),
    )).toThrow(NewsDataIntegrityError);
    const completedOpener = completedGame({ id: 5, weekPlayed: 1 });
    const openerStory = story({ id: 'game:5', gameId: 5, week: 1 });
    expect(() => assertNewsIntegrity(
      [story(), openerStory, ...previewStories()],
      [completedGame(), completedOpener],
      new Set(),
      new Set([1, 2]),
    )).not.toThrow();

    const db = await getDb();
    for (const preview of previewStories()) await db.put('newsItems', preview);
    expect(await db.getAllFromIndex('newsItems', 'gameId', 5)).toEqual([]);
  });

  it('rolls back game and news writes when another batch record is invalid', async () => {
    await expect(commitSimulationBatch({
      league: buildTestLeague('season'),
      games: [completedGame()],
      details: [{ year: 2025 } as GameDetailRecord],
      newsItems: [story()],
    })).rejects.toBeDefined();

    const db = await getDb();
    expect(await db.getAll('games')).toEqual([]);
    expect(await db.getAll('newsItems')).toEqual([]);
    expect(await db.getAll('league')).toEqual([]);
  });

  it('rolls back playoff scheduling when its field story cannot be stored', async () => {
    const invalid = rankingStory() as RankingNewsItem & { unserializable?: unknown };
    invalid.unserializable = () => undefined;
    await expect(saveGamesAndLeague(
      [completedGame()],
      buildTestLeague('season'),
      [invalid],
    )).rejects.toBeDefined();
    const db = await getDb();
    expect(await db.getAll('games')).toEqual([]);
    expect(await db.getAll('newsItems')).toEqual([]);
    expect(await db.getAll('league')).toEqual([]);
  });
});
