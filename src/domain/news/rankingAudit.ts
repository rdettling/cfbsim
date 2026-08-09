import type { Team } from '../../types/domain';
import type { RankingNewsItem, RankingStoryAngle } from '../../types/news';
import type { RankingUpdate } from '../sim/rankings';
import {
  extractRankingStoryFacts,
  generatePlayoffFieldNews,
  generateWeeklyRankingNews,
  rankingStorylines,
  type RankingStoryTrace,
} from './rankings';
import { sortNewsItems } from './ordering';
import type { NewsworthinessBreakdown } from './newsworthiness';

export interface RankingNewsAuditEntry {
  auditId: string;
  source: 'simulation' | 'scenario';
  rootSeed: number;
  sample: number;
  season: number;
  item: RankingNewsItem | null;
  trace: RankingStoryTrace | null;
  updates: RankingUpdate[];
  expectedPublished: boolean;
}

export interface RankingNewsAuditMetrics {
  cases: number;
  published: number;
  publicationRate: number;
  angles: Record<string, number>;
  headlineTemplates: Record<string, number>;
  deckTemplates: Record<string, number>;
  importance: Record<string, number>;
  mixedFrontPage: {
    topFiveSlots: number;
    rankingSlots: number;
    rankingLeads: number;
    rankedParticipationRate: number;
    rankedLeadRate: number;
    unrankedLeadWithoutDramaIds: string[];
  };
  violations: Array<{ code: string; storyIds: string[] }>;
}

export const buildRankingAuditEntry = ({
  auditId,
  source,
  rootSeed,
  sample,
  season,
  year,
  week,
  updates,
  teamsById,
}: {
  auditId: string;
  source: RankingNewsAuditEntry['source'];
  rootSeed: number;
  sample: number;
  season: number;
  year: number;
  week: number;
  updates: RankingUpdate[];
  teamsById: Map<number, Team>;
}): RankingNewsAuditEntry => {
  const generated = generateWeeklyRankingNews({ year, week, updates, teamsById });
  const expectedPublished = week >= 1 && week <= 14 &&
    rankingStorylines(extractRankingStoryFacts({ year, week, updates })).length > 0;
  return {
    auditId,
    source,
    rootSeed,
    sample,
    season,
    item: generated?.item ?? null,
    trace: generated?.trace ?? null,
    updates,
    expectedPublished,
  };
};

export const buildPlayoffFieldAuditEntry = ({
  auditId,
  rootSeed,
  size,
  teamsById,
}: {
  auditId: string;
  rootSeed: number;
  size: 2 | 4 | 12;
  teamsById: Map<number, Team>;
}): RankingNewsAuditEntry => {
  const selectedTeamIds = [...teamsById.values()]
    .sort((left, right) => left.ranking - right.ranking)
    .slice(0, size)
    .map(team => team.id);
  const generated = generatePlayoffFieldNews({
    year: 2026,
    week: 15,
    selectedTeamIds,
    teamsById,
  });
  return {
    auditId,
    source: 'scenario',
    rootSeed,
    sample: 0,
    season: 0,
    item: generated.item,
    trace: generated.trace,
    updates: generated.trace.facts.updates,
    expectedPublished: true,
  };
};

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

export const evaluateRankingNewsAudit = (
  entries: RankingNewsAuditEntry[],
): RankingNewsAuditMetrics => {
  const angles: Record<string, number> = {};
  const headlineTemplates: Record<string, number> = {};
  const deckTemplates: Record<string, number> = {};
  const importance: Record<string, number> = {};
  const violations = new Map<string, string[]>();
  const fail = (code: string, id: string) => {
    const ids = violations.get(code) ?? [];
    ids.push(id);
    violations.set(code, ids);
  };
  entries.forEach(entry => {
    if (Boolean(entry.item) !== entry.expectedPublished || Boolean(entry.trace) !== entry.expectedPublished) {
      fail('ranking_publication_mismatch', entry.auditId);
      return;
    }
    if (!entry.item || !entry.trace) return;
    increment(angles, entry.item.primaryAngle);
    increment(headlineTemplates, entry.trace.headlineTemplateId);
    increment(deckTemplates, entry.trace.deckTemplateId);
    increment(importance, String(entry.item.importance));
    const componentTotal = entry.trace.newsworthiness.components
      .reduce((sum, component) => sum + component.points, 0);
    if (
      entry.item.id !== `rankings:${entry.item.year}:${entry.item.week}` ||
      componentTotal !== entry.item.importance ||
      entry.trace.newsworthiness.total !== entry.item.importance ||
      entry.item.featuredTeamIds.length !== new Set(entry.item.featuredTeamIds).size
    ) fail('invalid_ranking_trace', entry.auditId);
    if (entry.item.primaryAngle === 'playoff_field') {
      if (![2, 4, 12].includes(entry.item.featuredTeamIds.length) || entry.item.week !== 15) {
        fail('invalid_playoff_field_story', entry.auditId);
      }
    } else {
      const expected = rankingStorylines(
        extractRankingStoryFacts({
          year: entry.item.year,
          week: entry.item.week,
          updates: entry.updates,
        }),
      );
      if (expected[0] !== entry.item.primaryAngle ||
        JSON.stringify(expected) !== JSON.stringify(entry.item.storylines)) {
        fail('unsupported_ranking_claim', entry.auditId);
      }
    }
  });
  const published = entries.filter(entry => entry.item).length;
  return {
    cases: entries.length,
    published,
    publicationRate: entries.length ? Number((published / entries.length).toFixed(6)) : 0,
    angles: Object.fromEntries(Object.entries(angles).sort()),
    headlineTemplates: Object.fromEntries(Object.entries(headlineTemplates).sort()),
    deckTemplates: Object.fromEntries(Object.entries(deckTemplates).sort()),
    importance: Object.fromEntries(Object.entries(importance).sort()),
    mixedFrontPage: {
      topFiveSlots: 0,
      rankingSlots: 0,
      rankingLeads: 0,
      rankedParticipationRate: 0,
      rankedLeadRate: 0,
      unrankedLeadWithoutDramaIds: [],
    },
    violations: [...violations.entries()].sort().map(([code, storyIds]) => ({
      code,
      storyIds: storyIds.sort(),
    })),
  };
};

export const evaluateMixedNewsFrontPages = (
  gameEntries: Array<{
    auditId: string;
    source: 'simulation' | 'scenario';
    rootSeed: number;
    sample: number;
    season: number;
    item: { id: string; type: 'game'; year: number; week: number; importance: number; gameId: number };
    trace: { facts: { winnerEditorialRank: number | null; loserEditorialRank: number | null }; newsworthiness: NewsworthinessBreakdown };
  }>,
  rankingEntries: RankingNewsAuditEntry[],
) => {
  type FrontPageEntry = {
    auditId: string;
    rootSeed: number;
    sample: number;
    season: number;
    item: RankingNewsItem | (typeof gameEntries)[number]['item'];
    ranked: boolean;
    drama: number;
  };
  const entries: FrontPageEntry[] = [
    ...gameEntries.filter(entry => entry.source === 'simulation').map(entry => ({
      auditId: entry.auditId,
      rootSeed: entry.rootSeed,
      sample: entry.sample,
      season: entry.season,
      item: entry.item,
      ranked: entry.trace.facts.winnerEditorialRank !== null ||
        entry.trace.facts.loserEditorialRank !== null,
      drama: entry.trace.newsworthiness.dimensions.drama,
    })),
    ...rankingEntries.filter((entry): entry is RankingNewsAuditEntry & { item: RankingNewsItem } =>
      entry.source === 'simulation' && entry.item !== null).map(entry => ({
        auditId: entry.auditId,
        rootSeed: entry.rootSeed,
        sample: entry.sample,
        season: entry.season,
        item: entry.item,
        ranked: true,
        drama: entry.trace?.newsworthiness.dimensions.drama ?? 0,
      })),
  ];
  const weeks = new Map<string, FrontPageEntry[]>();
  entries.forEach(entry => {
    const key = `${entry.rootSeed}:${entry.sample}:${entry.season}:${entry.item.year}:${entry.item.week}`;
    const values = weeks.get(key) ?? [];
    values.push(entry);
    weeks.set(key, values);
  });
  let topFiveSlots = 0;
  let rankedSlots = 0;
  let leads = 0;
  let rankedLeads = 0;
  let rankingSlots = 0;
  let rankingLeads = 0;
  const unrankedLeadWithoutDramaIds: string[] = [];
  weeks.forEach(values => {
    const top = sortNewsItems(values.map(value => ({ ...value, ...value.item }))).slice(0, 5);
    topFiveSlots += top.length;
    rankedSlots += top.filter(entry => entry.ranked).length;
    rankingSlots += top.filter(entry => entry.item.type === 'rankings').length;
    const lead = top[0];
    if (!lead) return;
    leads += 1;
    if (lead.ranked) rankedLeads += 1;
    if (lead.item.type === 'rankings') rankingLeads += 1;
    if (!lead.ranked && lead.drama < 20) unrankedLeadWithoutDramaIds.push(lead.auditId);
  });
  return {
    topFiveSlots,
    rankingSlots,
    rankingLeads,
    rankedParticipationRate: topFiveSlots ? Number((rankedSlots / topFiveSlots).toFixed(6)) : 0,
    rankedLeadRate: leads ? Number((rankedLeads / leads).toFixed(6)) : 0,
    unrankedLeadWithoutDramaIds: unrankedLeadWithoutDramaIds.sort(),
  };
};

export const hasRankingAngleCoverage = (
  metrics: RankingNewsAuditMetrics,
  angle: RankingStoryAngle,
) => (metrics.angles[angle] ?? 0) > 0;
