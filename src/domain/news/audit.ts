import type { GeneratedGameNews } from './generate';
import { sortNewsItems } from './ordering';
import {
  buildNewsAuditViolations,
  referencesRankOutsideTop25,
} from './auditValidation';
import { STORY_TEMPLATES_BY_ID } from './templates';
import { DECK_TEMPLATES_BY_ID } from './deckTemplates';
import { hasOddsUpset, hasRankingUpset } from './policy';
import {
  NEWSWORTHINESS_COMPONENTS,
  NEWSWORTHINESS_DIMENSIONS,
  type NewsworthinessDimension,
} from './newsworthiness';
import { evaluateRankingNewsAudit, type RankingNewsAuditMetrics } from './rankingAudit';
import { evaluatePreviewNewsAudit, type PreviewNewsAuditMetrics } from './previewAudit';

export type NewsAuditSource = 'simulation' | 'scenario';

export interface NewsAuditEntry extends GeneratedGameNews {
  auditId: string;
  source: NewsAuditSource;
  rootSeed: number;
  sample: number;
  season: number;
  winnerName: string;
  loserName: string;
  winnerConference: string;
  loserConference: string;
  featuredPosition: string | null;
}

export interface NewsAuditNotice {
  code: string;
  message: string;
  storyIds: string[];
}

export interface NewsAuditMetrics {
  primaryAngles: Record<string, number>;
  supportingStorylines: Record<string, number>;
  gameTypes: Record<string, number>;
  deckRules: Record<string, number>;
  templates: Record<string, number>;
  deckTemplates: Record<string, number>;
  headlineSyntaxFamilies: Record<string, number>;
  deckSyntaxFamilies: Record<string, number>;
  scoreLocations: Record<string, number>;
  headlineDeckFactOverlap: Record<string, number>;
  newsworthiness: { min: number; median: number; p95: number; max: number };
  dimensionScores: Record<NewsworthinessDimension, {
    min: number;
    median: number;
    p95: number;
    max: number;
    mean: number;
  }>;
  storyRankTiers: Record<string, number>;
  weeklyTopFiveRankTiers: Record<string, number>;
  weeklyLeadRankTiers: Record<string, number>;
  frontPageComposition: {
    topFiveSlots: number;
    rankedTopFiveSlots: number;
    rankedTopFiveRate: number;
    leads: number;
    rankedLeads: number;
    rankedLeadRate: number;
    unrankedLeadIds: string[];
    unrankedLeadWithoutDramaIds: string[];
  };
  v3FrontPageComparison: {
    changedTopFiveSlots: number;
    totalTopFiveSlots: number;
    changedTopFiveRate: number;
    changedLeadIds: string[];
  };
  exactHeadlineDuplicates: Record<string, string[]>;
  exactDeckDuplicates: Record<string, string[]>;
  crossSeedHeadlineDuplicates: Record<string, string[]>;
  crossSeedDeckDuplicates: Record<string, string[]>;
  normalizedHeadlinePatterns: Record<string, string[]>;
  normalizedDeckPatterns: Record<string, string[]>;
  weeklyHeadlinePatternCollisions: Record<string, string[]>;
  weeklyDeckPatternCollisions: Record<string, string[]>;
  weeklyLeadTeams: Record<string, number>;
  weeklyLeadConferences: Record<string, number>;
  weeklyTopFiveTeams: Record<string, number>;
  weeklyTopFiveConferences: Record<string, number>;
  featuredPositions: Record<string, number>;
  rankingReferencesOutsideTop25: string[];
  combinedContexts: Record<string, number>;
  highestImportanceIds: string[];
  lowestImportanceIds: string[];
}

export interface NewsAuditSummary {
  configuration: {
    seed: number;
    seeds: number;
    seasons: number;
    replaySeeds: number;
    startYear: number;
  };
  checksum: string;
  gameContentChecksum: string;
  newsItemChecksum: string;
  previewItemChecksum: string;
  newsContentChecksum: string;
  editorialOutcomeChecksum: string;
  counts: {
    total: number;
    simulated: number;
    scenarios: number;
    rankingCases: number;
    rankingPublished: number;
    previewCases: number;
    previewPublished: number;
  };
  metrics: NewsAuditMetrics;
  rankingAudit: RankingNewsAuditMetrics;
  previewAudit: PreviewNewsAuditMetrics;
  violations: NewsAuditNotice[];
  warnings: NewsAuditNotice[];
}

const increment = (target: Record<string, number>, key: string) => {
  target[key] = (target[key] ?? 0) + 1;
};

const sortedCounts = (counts: Record<string, number>) =>
  Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));

const replaceAllLiteral = (value: string, search: string, replacement: string) =>
  search ? value.split(search).join(replacement) : value;

const normalizedCopy = (value: string, entry: NewsAuditEntry) => {
  let normalized = value.toLowerCase();
  Object.entries(entry.trace.tokens)
    .sort((left, right) => right[1].length - left[1].length)
    .forEach(([token, rendered]) => {
      normalized = replaceAllLiteral(normalized, rendered.toLowerCase(), `<${token}>`);
    });
  return normalized
    .replace(/\b\d+(?::\d+)?\b/g, '<number>')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizedHeadline = (entry: NewsAuditEntry) =>
  STORY_TEMPLATES_BY_ID.get(entry.trace.templateId)?.text.toLowerCase() ??
  normalizedCopy(entry.item.headline, entry);

const normalizedDeck = (entry: NewsAuditEntry) =>
  DECK_TEMPLATES_BY_ID.get(entry.trace.deckTemplateId)?.text.toLowerCase() ??
  normalizedCopy(entry.item.deck, entry);

const groupCopy = (
  entries: NewsAuditEntry[],
  selector: (entry: NewsAuditEntry) => string,
  normalize: boolean,
) => {
  const grouped = new Map<string, string[]>();
  entries.forEach(entry => {
    const selected = selector(entry);
    const key = normalize ? normalizedCopy(selected, entry) : selected;
    const ids = grouped.get(key) ?? [];
    ids.push(entry.auditId);
    grouped.set(key, ids);
  });
  return Object.fromEntries(
    [...grouped.entries()]
      .filter(([, ids]) => ids.length > 1)
      .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0])),
  );
};

const groupCopyWithin = (
  entries: NewsAuditEntry[],
  selector: (entry: NewsAuditEntry) => string,
  normalize: boolean,
  scope: (entry: NewsAuditEntry) => string,
  minimum = 2,
) => {
  const grouped = new Map<string, { label: string; ids: string[] }>();
  entries.forEach(entry => {
    const selected = selector(entry);
    const label = normalize ? normalizedCopy(selected, entry) : selected;
    const key = `${scope(entry)}\u0000${label}`;
    const current = grouped.get(key) ?? { label: `${scope(entry)} :: ${label}`, ids: [] };
    current.ids.push(entry.auditId);
    grouped.set(key, current);
  });
  return Object.fromEntries(
    [...grouped.values()]
      .filter(group => group.ids.length >= minimum)
      .sort((left, right) => right.ids.length - left.ids.length || left.label.localeCompare(right.label))
      .map(group => [group.label, group.ids]),
  );
};

const groupCopyAcrossScopes = (
  entries: NewsAuditEntry[],
  selector: (entry: NewsAuditEntry) => string,
  scope: (entry: NewsAuditEntry) => string,
) => {
  const grouped = new Map<string, { ids: string[]; scopes: Set<string> }>();
  entries.forEach(entry => {
    const label = selector(entry);
    const current = grouped.get(label) ?? { ids: [], scopes: new Set<string>() };
    current.ids.push(entry.auditId);
    current.scopes.add(scope(entry));
    grouped.set(label, current);
  });
  return Object.fromEntries(
    [...grouped.entries()]
      .filter(([, group]) => group.scopes.size > 1)
      .sort((left, right) => right[1].ids.length - left[1].ids.length || left[0].localeCompare(right[0]))
      .map(([label, group]) => [label, group.ids]),
  );
};

const editorialOutcome = ({ item }: NewsAuditEntry) => ({
  id: item.id,
  type: item.type,
  year: item.year,
  week: item.week,
  gameId: item.gameId,
  teamIds: item.teamIds,
  featuredPlayerId: item.featuredPlayerId,
  primaryAngle: item.primaryAngle,
  storylines: item.storylines,
  importance: item.importance,
});

const newsContent = ({ item }: NewsAuditEntry) => {
  const { importance: _importance, ...content } = item;
  return content;
};

const rankTier = (entry: NewsAuditEntry) => {
  const ranks = [
    entry.trace.facts.winnerEditorialRank,
    entry.trace.facts.loserEditorialRank,
  ].filter((rank): rank is number => rank !== null);
  if (!ranks.length) return 'unranked';
  const rank = Math.min(...ranks);
  if (rank <= 5) return '1_5';
  if (rank <= 10) return '6_10';
  if (rank <= 15) return '11_15';
  return '16_25';
};

const v3Importance = (entry: NewsAuditEntry) => {
  const facts = entry.trace.facts;
  let total = NEWSWORTHINESS_COMPONENTS[`base:${facts.gameType}`].points;
  if (hasOddsUpset(facts.upsetEvidence)) total += 25;
  if (hasRankingUpset(facts.upsetEvidence)) total += 20;
  if (facts.overtime > 0) total += 12;
  if (facts.lateWinningSecondsLeft !== null) total += 12;
  if (facts.largestWinnerDeficit >= 14) total += 12;
  else if (facts.largestWinnerDeficit >= 7) total += 6;
  if (
    facts.winnerEditorialRank !== null && facts.winnerEditorialRank <= 10 &&
    facts.loserEditorialRank !== null && facts.loserEditorialRank <= 10
  ) total += 10;
  if (facts.rivalryKey !== null) total += 8;
  if (facts.featuredPerformance !== null) total += 5;
  if (facts.shutout) total += 5;
  if (facts.margin >= 28) total += 4;
  return total;
};

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))];
};

const notice = (code: string, message: string, storyIds: string[] = []): NewsAuditNotice => ({
  code,
  message,
  storyIds: [...storyIds].sort(),
});

export const checksumValues = (values: unknown[]) => {
  let hash = 2166136261;
  const text = values
    .map(value => JSON.stringify(value))
    .sort()
    .join('\n');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const evaluateNewsAudit = (
  entries: NewsAuditEntry[],
  configuration: NewsAuditSummary['configuration'],
): NewsAuditSummary => {
  const natural = entries.filter(entry => entry.source === 'simulation');
  const scenarios = entries.filter(entry => entry.source === 'scenario');
  const newsContentChecksum = checksumValues(entries.map(newsContent));
  const committedRepresentative = configuration.seed === 20260809 &&
    configuration.seeds === 3 &&
    configuration.seasons === 2 &&
    configuration.replaySeeds === 1 &&
    configuration.startYear === 2026;
  const primaryAngles: Record<string, number> = {};
  const supportingStorylines: Record<string, number> = {};
  const gameTypes: Record<string, number> = {};
  const deckRules: Record<string, number> = {};
  const templates: Record<string, number> = {};
  const deckTemplates: Record<string, number> = {};
  const headlineSyntaxFamilies: Record<string, number> = {};
  const deckSyntaxFamilies: Record<string, number> = {};
  const scoreLocations: Record<string, number> = {};
  const headlineDeckFactOverlap: Record<string, number> = {};
  const featuredPositions: Record<string, number> = {};
  const combinedContexts: Record<string, number> = {};
  const storyRankTiers: Record<string, number> = {};
  const dimensionValues = Object.fromEntries(
    NEWSWORTHINESS_DIMENSIONS.map(dimension => [dimension, [] as number[]]),
  ) as Record<NewsworthinessDimension, number[]>;
  natural.forEach(entry => {
    increment(primaryAngles, entry.item.primaryAngle);
    entry.item.storylines.forEach(angle => increment(supportingStorylines, angle));
    increment(gameTypes, entry.trace.facts.gameType);
    increment(deckRules, entry.trace.deckRuleId);
    increment(templates, entry.trace.templateId);
    increment(deckTemplates, entry.trace.deckTemplateId);
    increment(headlineSyntaxFamilies, entry.trace.headlineSyntaxFamily);
    increment(deckSyntaxFamilies, entry.trace.deckSyntaxFamily);
    increment(scoreLocations, entry.trace.scoreLocation);
    const overlap = entry.trace.headlineFacts.filter(fact => entry.trace.deckFacts.includes(fact)).length;
    increment(headlineDeckFactOverlap, String(overlap));
    if (entry.featuredPosition) increment(featuredPositions, entry.featuredPosition);
    increment(storyRankTiers, rankTier(entry));
    NEWSWORTHINESS_DIMENSIONS.forEach(dimension => {
      dimensionValues[dimension].push(entry.trace.newsworthiness.dimensions[dimension]);
    });
    const contexts = entry.item.storylines;
    if (contexts.includes('upset') && contexts.includes('comeback')) increment(combinedContexts, 'upset+comeback');
    if (contexts.includes('rivalry') && contexts.includes('late_decider')) increment(combinedContexts, 'rivalry+late_decider');
    if (entry.trace.facts.gameType !== 'regular_season' && contexts.includes('overtime')) increment(combinedContexts, 'postseason+overtime');
  });

  const weeklyLeadTeams: Record<string, number> = {};
  const weeklyLeadConferences: Record<string, number> = {};
  const weeklyTopFiveTeams: Record<string, number> = {};
  const weeklyTopFiveConferences: Record<string, number> = {};
  const weeklyTopFiveRankTiers: Record<string, number> = {};
  const weeklyLeadRankTiers: Record<string, number> = {};
  const unrankedLeadIds: string[] = [];
  const unrankedLeadWithoutDramaIds: string[] = [];
  const changedLeadIds: string[] = [];
  let changedTopFiveSlots = 0;
  let totalTopFiveSlots = 0;
  const weekly = new Map<string, NewsAuditEntry[]>();
  natural.forEach(entry => {
    const key = `${entry.rootSeed}:${entry.sample}:${entry.item.year}:${entry.item.week}`;
    const list = weekly.get(key) ?? [];
    list.push(entry);
    weekly.set(key, list);
  });
  weekly.forEach(weekEntries => {
    const top = sortNewsItems(weekEntries.map(entry => ({
      ...entry,
      id: entry.item.id,
      type: entry.item.type,
      importance: entry.item.importance,
      gameId: entry.item.gameId,
    }))).slice(0, 5);
    const previousTop = sortNewsItems(weekEntries.map(entry => ({
      ...entry,
      id: entry.item.id,
      type: entry.item.type,
      importance: v3Importance(entry),
      gameId: entry.item.gameId,
    }))).slice(0, 5);
    const previousIds = new Set(previousTop.map(entry => entry.auditId));
    totalTopFiveSlots += top.length;
    changedTopFiveSlots += top.filter(entry => !previousIds.has(entry.auditId)).length;
    if (top[0]?.auditId !== previousTop[0]?.auditId && top[0]) changedLeadIds.push(top[0].auditId);
    top.forEach((entry, index) => {
      increment(weeklyTopFiveTeams, entry.winnerName);
      increment(weeklyTopFiveConferences, entry.winnerConference);
      increment(weeklyTopFiveRankTiers, rankTier(entry));
      if (index === 0) {
        increment(weeklyLeadTeams, entry.winnerName);
        increment(weeklyLeadConferences, entry.winnerConference);
        const tier = rankTier(entry);
        increment(weeklyLeadRankTiers, tier);
        if (tier === 'unranked') {
          unrankedLeadIds.push(entry.auditId);
          if (entry.trace.newsworthiness.dimensions.drama < 20) {
            unrankedLeadWithoutDramaIds.push(entry.auditId);
          }
        }
      }
    });
  });

  const outsideTop25 = natural
    .filter(referencesRankOutsideTop25)
    .map(entry => entry.auditId)
    .sort();
  const importance = natural.map(entry => entry.item.importance).sort((a, b) => a - b);
  const dimensionScores = Object.fromEntries(NEWSWORTHINESS_DIMENSIONS.map(dimension => {
    const values = [...dimensionValues[dimension]].sort((a, b) => a - b);
    return [dimension, {
      min: values[0] ?? 0,
      median: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      max: values[values.length - 1] ?? 0,
      mean: values.length
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))
        : 0,
    }];
  })) as NewsAuditMetrics['dimensionScores'];
  const seasonScope = (entry: NewsAuditEntry) => `${entry.rootSeed}:${entry.sample}:${entry.item.year}`;
  const dynastyScope = (entry: NewsAuditEntry) => `${entry.rootSeed}:${entry.sample}`;
  const withinSeasonHeadlineDuplicates = groupCopyWithin(natural, entry => entry.item.headline, false, seasonScope);
  const withinSeasonDeckDuplicates = groupCopyWithin(natural, entry => entry.item.deck, false, seasonScope);
  const crossSeedHeadlineDuplicates = groupCopyAcrossScopes(natural, entry => entry.item.headline, dynastyScope);
  const crossSeedDeckDuplicates = groupCopyAcrossScopes(natural, entry => entry.item.deck, dynastyScope);
  const normalizedHeadlinePatterns = groupCopy(natural, normalizedHeadline, false);
  const normalizedDeckPatterns = groupCopy(natural, normalizedDeck, false);
  const weeklyScope = (entry: NewsAuditEntry) => `${seasonScope(entry)}:${entry.item.week}`;
  const weeklyHeadlinePatternCollisions = groupCopyWithin(
    natural.filter(entry => {
      const weekEntries = weekly.get(weeklyScope(entry)) ?? [];
      return sortNewsItems(weekEntries.map(candidate => ({
        ...candidate,
        id: candidate.item.id,
        type: candidate.item.type,
        importance: candidate.item.importance,
        gameId: candidate.item.gameId,
      }))).slice(0, 5).some(candidate => candidate.auditId === entry.auditId);
    }),
    normalizedHeadline,
    false,
    weeklyScope,
    3,
  );
  const weeklyDeckPatternCollisions = groupCopyWithin(
    natural.filter(entry => {
      const weekEntries = weekly.get(weeklyScope(entry)) ?? [];
      return sortNewsItems(weekEntries.map(candidate => ({
        ...candidate,
        id: candidate.item.id,
        type: candidate.item.type,
        importance: candidate.item.importance,
        gameId: candidate.item.gameId,
      }))).slice(0, 5).some(candidate => candidate.auditId === entry.auditId);
    }),
    normalizedDeck,
    false,
    weeklyScope,
    3,
  );
  const orderedImportance = [...natural].sort((left, right) =>
    right.item.importance - left.item.importance || right.item.gameId - left.item.gameId,
  );

  const violations = buildNewsAuditViolations(entries);
  if (committedRepresentative && newsContentChecksum !== 'feffcb7c') {
    violations.push(notice(
      'news_content_drift',
      `Scoring changed news content checksum ${newsContentChecksum}; expected feffcb7c.`,
    ));
  }
  const warnings: NewsAuditNotice[] = [];
  const largestHeadlinePattern = Object.entries(normalizedHeadlinePatterns)[0];
  if (largestHeadlinePattern && largestHeadlinePattern[1].length / Math.max(1, natural.length) > 0.06) {
    warnings.push(notice('dominant_headline_pattern', 'One normalized headline pattern exceeds 6% of simulated stories.', largestHeadlinePattern[1]));
  }
  const largestDeckPattern = Object.entries(normalizedDeckPatterns)[0];
  if (largestDeckPattern && largestDeckPattern[1].length / Math.max(1, natural.length) > 0.1) {
    warnings.push(notice('dominant_deck_pattern', 'One normalized deck pattern exceeds 10% of simulated stories.', largestDeckPattern[1]));
  }
  const standoutIds = natural.filter(entry => entry.item.primaryAngle === 'standout_player').map(entry => entry.auditId);
  if (standoutIds.length / Math.max(1, natural.length) > 0.15) warnings.push(notice('standout_angle_dominance', 'Standout-player stories exceed 15% of the simulated corpus.', standoutIds));
  const featuredDeckIds = natural.filter(entry => entry.trace.deckRuleId === 'featured_performance').map(entry => entry.auditId);
  if (featuredDeckIds.length / Math.max(1, natural.length) > 0.25) warnings.push(notice('featured_deck_dominance', 'Featured-player decks exceed 25% of the simulated corpus.', featuredDeckIds));
  if (Object.keys(withinSeasonHeadlineDuplicates).length) warnings.push(notice('exact_headline_repetition', 'An exact headline repeats within one simulated season.', Object.values(withinSeasonHeadlineDuplicates).flat()));
  if (Object.keys(weeklyHeadlinePatternCollisions).length) warnings.push(notice('weekly_headline_pattern_collision', 'A normalized headline construction appears more than twice on one weekly front page.', Object.values(weeklyHeadlinePatternCollisions).flat()));
  if (Object.keys(weeklyDeckPatternCollisions).length) warnings.push(notice('weekly_deck_pattern_collision', 'A normalized deck construction appears more than twice on one weekly front page.', Object.values(weeklyDeckPatternCollisions).flat()));
  const featuredTotal = Object.values(featuredPositions).reduce((sum, count) => sum + count, 0);
  Object.entries(featuredPositions).forEach(([position, count]) => {
    if (featuredTotal >= 20 && count / featuredTotal > 0.5) {
      warnings.push(notice('featured_position_imbalance', `${position.toUpperCase()} accounts for more than 50% of featured players.`, natural.filter(entry => entry.featuredPosition === position).map(entry => entry.auditId)));
    }
  });
  const topFiveTotal = Object.values(weeklyTopFiveConferences).reduce((sum, count) => sum + count, 0);
  Object.entries(weeklyTopFiveConferences).forEach(([conference, count]) => {
    if (topFiveTotal >= 20 && count / topFiveTotal > 0.3) {
      warnings.push(notice('top_five_conference_concentration', `${conference} exceeds 30% of weekly top-five slots.`, natural.filter(entry => entry.winnerConference === conference).map(entry => entry.auditId)));
    }
  });
  const leadTotal = Object.values(weeklyLeadRankTiers).reduce((sum, count) => sum + count, 0);
  const rankedTopFive = topFiveTotal - (weeklyTopFiveRankTiers.unranked ?? 0);
  const rankedLeads = leadTotal - (weeklyLeadRankTiers.unranked ?? 0);
  const rankedTopFiveRate = topFiveTotal ? rankedTopFive / topFiveTotal : 0;
  const rankedLeadRate = leadTotal ? rankedLeads / leadTotal : 0;
  const representative = configuration.seeds >= 3 &&
    configuration.seasons >= 2 && configuration.replaySeeds >= 1;
  if (representative && (rankedTopFiveRate < 0.85 || rankedTopFiveRate > 0.92)) {
    warnings.push(notice(
      'ranked_top_five_profile',
      `Ranked participation occupies ${(rankedTopFiveRate * 100).toFixed(1)}% of weekly top-five slots; expected 85–92%.`,
    ));
  }
  if (representative && (rankedLeadRate < 0.93 || rankedLeadRate > 0.98)) {
    warnings.push(notice(
      'ranked_lead_profile',
      `Ranked participation occupies ${(rankedLeadRate * 100).toFixed(1)}% of weekly leads; expected 93–98%.`,
    ));
  }
  if (representative && unrankedLeadWithoutDramaIds.length) {
    warnings.push(notice(
      'unranked_lead_without_drama',
      'An unranked-only lead story has fewer than 20 verified drama points.',
      unrankedLeadWithoutDramaIds,
    ));
  }

  return {
    configuration,
    checksum: checksumValues(entries),
    gameContentChecksum: newsContentChecksum,
    newsItemChecksum: checksumValues(entries.map(entry => entry.item)),
    previewItemChecksum: checksumValues([]),
    newsContentChecksum,
    editorialOutcomeChecksum: checksumValues(entries.map(editorialOutcome)),
    counts: {
      total: entries.length,
      simulated: natural.length,
      scenarios: scenarios.length,
      rankingCases: 0,
      rankingPublished: 0,
      previewCases: 0,
      previewPublished: 0,
    },
    metrics: {
      primaryAngles: sortedCounts(primaryAngles),
      supportingStorylines: sortedCounts(supportingStorylines),
      gameTypes: sortedCounts(gameTypes),
      deckRules: sortedCounts(deckRules),
      templates: sortedCounts(templates),
      deckTemplates: sortedCounts(deckTemplates),
      headlineSyntaxFamilies: sortedCounts(headlineSyntaxFamilies),
      deckSyntaxFamilies: sortedCounts(deckSyntaxFamilies),
      scoreLocations: sortedCounts(scoreLocations),
      headlineDeckFactOverlap: sortedCounts(headlineDeckFactOverlap),
      newsworthiness: {
        min: importance[0] ?? 0,
        median: percentile(importance, 0.5),
        p95: percentile(importance, 0.95),
        max: importance[importance.length - 1] ?? 0,
      },
      dimensionScores,
      storyRankTiers: sortedCounts(storyRankTiers),
      weeklyTopFiveRankTiers: sortedCounts(weeklyTopFiveRankTiers),
      weeklyLeadRankTiers: sortedCounts(weeklyLeadRankTiers),
      frontPageComposition: {
        topFiveSlots: topFiveTotal,
        rankedTopFiveSlots: rankedTopFive,
        rankedTopFiveRate: Number(rankedTopFiveRate.toFixed(6)),
        leads: leadTotal,
        rankedLeads,
        rankedLeadRate: Number(rankedLeadRate.toFixed(6)),
        unrankedLeadIds: [...unrankedLeadIds].sort(),
        unrankedLeadWithoutDramaIds: [...unrankedLeadWithoutDramaIds].sort(),
      },
      v3FrontPageComparison: {
        changedTopFiveSlots,
        totalTopFiveSlots,
        changedTopFiveRate: totalTopFiveSlots
          ? Number((changedTopFiveSlots / totalTopFiveSlots).toFixed(6))
          : 0,
        changedLeadIds: [...changedLeadIds].sort(),
      },
      exactHeadlineDuplicates: withinSeasonHeadlineDuplicates,
      exactDeckDuplicates: withinSeasonDeckDuplicates,
      crossSeedHeadlineDuplicates,
      crossSeedDeckDuplicates,
      normalizedHeadlinePatterns,
      normalizedDeckPatterns,
      weeklyHeadlinePatternCollisions,
      weeklyDeckPatternCollisions,
      weeklyLeadTeams: sortedCounts(weeklyLeadTeams),
      weeklyLeadConferences: sortedCounts(weeklyLeadConferences),
      weeklyTopFiveTeams: sortedCounts(weeklyTopFiveTeams),
      weeklyTopFiveConferences: sortedCounts(weeklyTopFiveConferences),
      featuredPositions: sortedCounts(featuredPositions),
      rankingReferencesOutsideTop25: outsideTop25,
      combinedContexts: sortedCounts(combinedContexts),
      highestImportanceIds: orderedImportance.slice(0, 10).map(entry => entry.auditId),
      lowestImportanceIds: orderedImportance.slice(-10).reverse().map(entry => entry.auditId),
    },
    violations,
    warnings,
    rankingAudit: evaluateRankingNewsAudit([]),
    previewAudit: evaluatePreviewNewsAudit([]),
  };
};
