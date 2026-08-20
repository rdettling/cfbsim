import type { GameRecord } from '../../../src/types/db';
import type { Team } from '../../../src/types/domain';
import { PREVIEW_STORY_ANGLES, type PreviewStoryAngle } from '../../../src/types/news';
import {
  NEWSWORTHINESS_COMPONENTS,
  type NewsworthinessComponentId,
} from '../../../src/domain/news/newsworthiness';
import { PREVIEW_TEMPLATES_BY_ID } from '../../../src/domain/news/previewTemplates';
import { generatePreseasonNews, type PreviewStoryTrace } from '../../../src/domain/news/previews';

type GeneratedPreview = ReturnType<typeof generatePreseasonNews>[number];

interface PreviewAuditExpected {
  teamIds: Record<PreviewStoryAngle, number[]>;
  featuredGameId: number;
  components: Record<PreviewStoryAngle, NewsworthinessComponentId[]>;
}

export interface PreviewNewsAuditEntry {
  auditId: string;
  source: 'simulation' | 'scenario';
  rootSeed: number;
  sample: number;
  season: number;
  year: number;
  defendingChampionId: number | null;
  stories: GeneratedPreview[];
  expected: PreviewAuditExpected;
  deterministic: boolean;
}

export interface PreviewNewsAuditMetrics {
  cases: number;
  published: number;
  angles: Record<string, number>;
  headlineTemplates: Record<string, number>;
  deckTemplates: Record<string, number>;
  violations: Array<{ code: string; storyIds: string[] }>;
}

const rankComponent = (rank: number): NewsworthinessComponentId | null => {
  if (rank < 1 || rank > 25) return null;
  if (rank <= 5) return 'rank_participation:1_5';
  if (rank <= 10) return 'rank_participation:6_10';
  if (rank <= 15) return 'rank_participation:11_15';
  return 'rank_participation:16_25';
};

const expectedComponents = (
  angle: PreviewStoryAngle,
  ranks: number[],
  bothRanked = false,
  rivalry = false,
) => {
  const components: NewsworthinessComponentId[] = [`base:${angle}`];
  const ranked = ranks.filter(rank => rank >= 1 && rank <= 25);
  const participation = ranked.length ? rankComponent(Math.min(...ranked)) : null;
  if (participation) components.push(participation);
  if (bothRanked) components.push('both_ranked');
  if (rivalry) components.push('rivalry');
  return components;
};

export const buildPreviewNewsAuditEntry = ({
  auditId,
  source,
  rootSeed,
  sample,
  season,
  year,
  teams,
  games,
  defendingChampionId,
}: {
  auditId: string;
  source: PreviewNewsAuditEntry['source'];
  rootSeed: number;
  sample: number;
  season: number;
  year: number;
  teams: Team[];
  games: GameRecord[];
  defendingChampionId: number | null;
}): PreviewNewsAuditEntry => {
  const input = { year, teams, games, defendingChampionId };
  const stories = generatePreseasonNews(input);
  const replay = generatePreseasonNews(input);
  const ranked = [...teams].sort((left, right) => left.ranking - right.ranking);
  const topFive = ranked.slice(0, 5);
  const topFour = ranked.slice(0, 4);
  const teamIds = new Set(teams.map(team => team.id));
  const championId = defendingChampionId !== null && teamIds.has(defendingChampionId)
    ? defendingChampionId
    : null;
  const unplayed = games.filter(game => game.year === year && game.winnerId === null);
  const openingWeek = Math.min(...unplayed.map(game => game.weekPlayed));
  const opener = unplayed.filter(game => game.weekPlayed === openingWeek)
    .sort((left, right) =>
      right.watchability - left.watchability || left.id - right.id)[0];
  if (!opener) throw new Error('Preview audit requires an opening matchup.');
  const openerRanks = [opener.rankATOG, opener.rankBTOG].filter(rank => rank >= 1 && rank <= 25);
  return {
    auditId,
    source,
    rootSeed,
    sample,
    season,
    year,
    defendingChampionId,
    stories,
    expected: {
      teamIds: {
        preseason_poll: topFive.map(team => team.id),
        national_outlook: [...new Set([
          ...(championId === null ? [] : [championId]),
          ...topFour.map(team => team.id),
        ])],
        marquee_opener: [opener.teamAId, opener.teamBId],
      },
      featuredGameId: opener.id,
      components: {
        preseason_poll: expectedComponents('preseason_poll', topFive.map(team => team.ranking)),
        national_outlook: expectedComponents(
          'national_outlook',
          [...new Set([
            ...(championId === null ? [] : [championId]),
            ...topFour.map(team => team.id),
          ])].map(id => teams.find(team => team.id === id)?.ranking ?? 999),
        ),
        marquee_opener: expectedComponents(
          'marquee_opener',
          openerRanks,
          openerRanks.length === 2,
          opener.rivalryKey !== null,
        ),
      },
    },
    deterministic: JSON.stringify(stories) === JSON.stringify(replay),
  };
};

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const validatesScore = (
  trace: PreviewStoryTrace,
  expectedIds: NewsworthinessComponentId[],
) => {
  const actualIds = trace.newsworthiness.components.map(component => component.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) return false;
  const dimensions = { consequence: 0, national_relevance: 0, drama: 0 };
  let total = 0;
  for (const id of expectedIds) {
    const component = NEWSWORTHINESS_COMPONENTS[id];
    dimensions[component.dimension] += component.points;
    total += component.points;
  }
  return total === trace.newsworthiness.total &&
    JSON.stringify(dimensions) === JSON.stringify(trace.newsworthiness.dimensions);
};

export const evaluatePreviewNewsAudit = (
  entries: PreviewNewsAuditEntry[],
): PreviewNewsAuditMetrics => {
  const angles: Record<string, number> = {};
  const headlineTemplates: Record<string, number> = {};
  const deckTemplates: Record<string, number> = {};
  const violations: PreviewNewsAuditMetrics['violations'] = [];
  for (const entry of entries) {
    const invalidIds: string[] = [];
    const seen = new Set<PreviewStoryAngle>();
    for (const { item, trace } of entry.stories) {
      increment(angles, item.primaryAngle);
      increment(headlineTemplates, trace.headlineTemplateId);
      increment(deckTemplates, trace.deckTemplateId);
      seen.add(item.primaryAngle);
      const expectedGameId = item.primaryAngle === 'marquee_opener'
        ? entry.expected.featuredGameId
        : null;
      const valid = item.id === `preview:${entry.year}:${item.primaryAngle}` &&
        item.year === entry.year && item.week === 0 &&
        item.storylines.length === 1 && item.storylines[0] === item.primaryAngle &&
        JSON.stringify(item.featuredTeamIds) ===
          JSON.stringify(entry.expected.teamIds[item.primaryAngle]) &&
        item.featuredGameId === expectedGameId &&
        trace.angle === item.primaryAngle &&
        trace.featuredGameId === item.featuredGameId &&
        JSON.stringify(trace.featuredTeamIds) === JSON.stringify(item.featuredTeamIds) &&
        trace.defendingChampionId === entry.defendingChampionId &&
        PREVIEW_TEMPLATES_BY_ID.has(trace.headlineTemplateId) &&
        PREVIEW_TEMPLATES_BY_ID.has(trace.deckTemplateId) &&
        !/[{}]/.test(`${item.headline}${item.deck}`) &&
        item.importance === trace.newsworthiness.total &&
        validatesScore(trace, entry.expected.components[item.primaryAngle]);
      if (!valid) invalidIds.push(`${entry.auditId}:${item.primaryAngle}`);
    }
    const complete = PREVIEW_STORY_ANGLES.every(angle => seen.has(angle)) &&
      seen.size === PREVIEW_STORY_ANGLES.length &&
      entry.stories.length === PREVIEW_STORY_ANGLES.length;
    if (!entry.deterministic || !complete || invalidIds.length) {
      violations.push({
        code: !entry.deterministic ? 'nondeterministic_preview' : 'invalid_preview_story',
        storyIds: invalidIds.length ? invalidIds.sort() : [entry.auditId],
      });
    }
  }
  return {
    cases: entries.length,
    published: entries.reduce((sum, entry) => sum + entry.stories.length, 0),
    angles: Object.fromEntries(Object.entries(angles).sort()),
    headlineTemplates: Object.fromEntries(Object.entries(headlineTemplates).sort()),
    deckTemplates: Object.fromEntries(Object.entries(deckTemplates).sort()),
    violations,
  };
};
