import type { NewsItem } from '../../types/news';

type SortableNewsItem = {
  id: string;
  type: NewsItem['type'];
  importance: number;
  gameId?: number;
};

const typeOrder = (item: SortableNewsItem): number => {
  switch (item.type) {
    case 'game': return 0;
    case 'rankings': return 1;
    case 'preview': return 2;
  }
};

export const sortNewsItems = <T extends SortableNewsItem>(items: T[]) =>
  [...items].sort((left, right) => {
    const importance = right.importance - left.importance;
    if (importance) return importance;
    const type = typeOrder(left) - typeOrder(right);
    if (type) return type;
    if (left.type === 'game' && right.type === 'game') {
      return (right.gameId ?? 0) - (left.gameId ?? 0);
    }
    return right.id.localeCompare(left.id);
  });
