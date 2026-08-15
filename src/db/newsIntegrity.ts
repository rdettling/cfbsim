import type { GameRecord } from '../types/db';
import {
  GAME_STORY_ANGLES,
  PREVIEW_STORY_ANGLES,
  RANKING_STORY_ANGLES,
  type NewsItem,
  type PreviewStoryAngle,
} from '../types/news';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class NewsDataIntegrityError extends Error {
  constructor(message = 'Saved league news does not match the current data model.') {
    super(message);
    this.name = 'NewsDataIntegrityError';
  }
}

export const gameNewsId = (gameId: number): `game:${number}` => `game:${gameId}`;
export const rankingNewsId = (year: number, week: number): `rankings:${number}:${number}` =>
  `rankings:${year}:${week}`;
export const previewNewsId = (year: number, angle: PreviewStoryAngle) =>
  `preview:${year}:${angle}` as const;

const hasValidCommonFields = (value: Record<string, unknown>) =>
  Number.isInteger(value.year) &&
  Number.isInteger(value.week) &&
  typeof value.headline === 'string' &&
  Boolean(value.headline.trim()) &&
  typeof value.deck === 'string' &&
  Boolean(value.deck.trim()) &&
  Number.isFinite(value.importance);

const assertGameNewsItem = (value: Record<string, unknown>) => {
  if (
    value.id !== gameNewsId(Number(value.gameId)) ||
    !Number.isInteger(value.gameId) ||
    !Array.isArray(value.teamIds) ||
    value.teamIds.length !== 2 ||
    value.teamIds.some(id => !Number.isInteger(id)) ||
    (value.featuredPlayerId !== null && !Number.isInteger(value.featuredPlayerId)) ||
    typeof value.primaryAngle !== 'string' ||
    !GAME_STORY_ANGLES.includes(value.primaryAngle as never) ||
    !Array.isArray(value.storylines) ||
    !value.storylines.length ||
    value.storylines.some(angle =>
      typeof angle !== 'string' || !GAME_STORY_ANGLES.includes(angle as never))
  ) throw new NewsDataIntegrityError();
};

const assertRankingNewsItem = (value: Record<string, unknown>) => {
  if (
    value.id !== rankingNewsId(Number(value.year), Number(value.week)) ||
    !Array.isArray(value.featuredTeamIds) ||
    !value.featuredTeamIds.length ||
    value.featuredTeamIds.some(id => !Number.isInteger(id)) ||
    new Set(value.featuredTeamIds).size !== value.featuredTeamIds.length ||
    typeof value.primaryAngle !== 'string' ||
    !RANKING_STORY_ANGLES.includes(value.primaryAngle as never) ||
    !Array.isArray(value.storylines) ||
    !value.storylines.length ||
    value.storylines.some(angle =>
      typeof angle !== 'string' || !RANKING_STORY_ANGLES.includes(angle as never))
  ) throw new NewsDataIntegrityError();
};

const assertPreviewNewsItem = (value: Record<string, unknown>) => {
  if (
    typeof value.primaryAngle !== 'string' ||
    !PREVIEW_STORY_ANGLES.includes(value.primaryAngle as never) ||
    value.id !== previewNewsId(Number(value.year), value.primaryAngle as PreviewStoryAngle) ||
    value.week !== 0 ||
    !Array.isArray(value.featuredTeamIds) ||
    !value.featuredTeamIds.length ||
    value.featuredTeamIds.some(id => !Number.isInteger(id)) ||
    new Set(value.featuredTeamIds).size !== value.featuredTeamIds.length ||
    (value.featuredGameId !== null && !Number.isInteger(value.featuredGameId)) ||
    !Array.isArray(value.storylines) ||
    value.storylines.length !== 1 ||
    value.storylines[0] !== value.primaryAngle
  ) throw new NewsDataIntegrityError();
};

export function assertCurrentNewsItem(value: unknown): asserts value is NewsItem {
  if (!isRecord(value) || !hasValidCommonFields(value)) throw new NewsDataIntegrityError();
  switch (value.type) {
    case 'game':
      assertGameNewsItem(value);
      return;
    case 'rankings':
      assertRankingNewsItem(value);
      return;
    case 'preview':
      assertPreviewNewsItem(value);
      return;
    default:
      throw new NewsDataIntegrityError();
  }
}

const assertRankingReferences = (
  item: Extract<NewsItem, { type: 'rankings' }>,
  rankingWeeks: Set<string>,
  teamIds: Set<number>,
) => {
  const isField = item.primaryAngle === 'playoff_field';
  const weekKey = `${item.year}:${item.week}`;
  if (
    rankingWeeks.has(weekKey) ||
    item.storylines[0] !== item.primaryAngle ||
    item.featuredTeamIds.some(id => !teamIds.has(id)) ||
    (isField
      ? (item.week !== 15 || ![2, 4, 12].includes(item.featuredTeamIds.length))
      : (item.week < 1 || item.week > 14))
  ) throw new NewsDataIntegrityError();
  rankingWeeks.add(weekKey);
};

const assertPreviewReferences = (
  item: Extract<NewsItem, { type: 'preview' }>,
  gamesById: Map<number, GameRecord>,
  previewAnglesByYear: Map<number, Set<string>>,
  teamIds: Set<number>,
) => {
  const angles = previewAnglesByYear.get(item.year) ?? new Set<string>();
  const game = item.featuredGameId === null ? null : gamesById.get(item.featuredGameId);
  const validGame = item.primaryAngle === 'marquee_opener'
    ? Boolean(game && game.year === item.year && game.weekPlayed >= 1 &&
      item.featuredTeamIds.length === 2 &&
      item.featuredTeamIds[0] === game.teamAId && item.featuredTeamIds[1] === game.teamBId)
    : item.featuredGameId === null;
  if (
    angles.has(item.primaryAngle) ||
    item.featuredTeamIds.some(id => !teamIds.has(id)) ||
    !validGame
  ) throw new NewsDataIntegrityError();
  angles.add(item.primaryAngle);
  previewAnglesByYear.set(item.year, angles);
};

const assertGameReferences = (
  item: Extract<NewsItem, { type: 'game' }>,
  gamesById: Map<number, GameRecord>,
  itemGameIds: Set<number>,
  playerIds: Set<number>,
) => {
  const game = gamesById.get(item.gameId);
  if (
    !game ||
    game.winnerId === null ||
    itemGameIds.has(item.gameId) ||
    item.year !== game.year ||
    item.week !== game.weekPlayed ||
    item.teamIds[0] !== game.teamAId ||
    item.teamIds[1] !== game.teamBId ||
    (item.featuredPlayerId !== null && !playerIds.has(item.featuredPlayerId))
  ) throw new NewsDataIntegrityError();
  itemGameIds.add(item.gameId);
};

export const assertNewsIntegrity = (
  items: NewsItem[],
  games: GameRecord[],
  playerIds: Set<number>,
  teamIds = new Set(games.flatMap(game => [game.teamAId, game.teamBId])),
) => {
  const gamesById = new Map(games.map(game => [game.id, game]));
  const itemGameIds = new Set<number>();
  const rankingWeeks = new Set<string>();
  const previewAnglesByYear = new Map<number, Set<string>>();
  for (const item of items) {
    assertCurrentNewsItem(item);
    switch (item.type) {
      case 'game':
        assertGameReferences(item, gamesById, itemGameIds, playerIds);
        break;
      case 'rankings':
        assertRankingReferences(item, rankingWeeks, teamIds);
        break;
      case 'preview':
        assertPreviewReferences(item, gamesById, previewAnglesByYear, teamIds);
        break;
      default: {
        const unsupported: never = item;
        throw new NewsDataIntegrityError(`Unsupported news item: ${String(unsupported)}`);
      }
    }
  }
  for (const angles of previewAnglesByYear.values()) {
    if (angles.size !== PREVIEW_STORY_ANGLES.length ||
      PREVIEW_STORY_ANGLES.some(angle => !angles.has(angle))) {
      throw new NewsDataIntegrityError();
    }
  }
  if (games.some(game => game.winnerId === null
    ? itemGameIds.has(game.id)
    : !itemGameIds.has(game.id))) {
    throw new NewsDataIntegrityError();
  }
};
