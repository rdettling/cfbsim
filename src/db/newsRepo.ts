import type { GameNewsItem } from '../types/news';
import { getDb } from './db';
import {
  assertCurrentNewsItem,
  gameNewsId,
  NewsDataIntegrityError,
} from './newsIntegrity';

export const getGameNews = async (gameId: number): Promise<GameNewsItem | null> => {
  const item = await (await getDb()).get('newsItems', gameNewsId(gameId));
  if (item) assertCurrentNewsItem(item);
  if (item && item.type !== 'game') throw new NewsDataIntegrityError();
  return item ?? null;
};

export const getNewsByYear = async (year: number) => {
  const items = await (await getDb()).getAllFromIndex('newsItems', 'year', year);
  items.forEach(assertCurrentNewsItem);
  return items;
};

export const getNewsByWeek = async (year: number, week: number) => {
  const items = await (await getDb()).getAllFromIndex(
    'newsItems',
    'yearWeek',
    [year, week],
  );
  items.forEach(assertCurrentNewsItem);
  return items;
};
