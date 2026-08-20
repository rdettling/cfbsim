import { GAME_STORY_ANGLES, type GameStoryAngle } from '../../../src/types/news';
import type { NewsAuditEntry, NewsAuditSummary } from './audit';
import { sortNewsItems } from '../../../src/domain/news/ordering';
import type { RankingNewsAuditEntry } from './rankingAudit';
import type { PreviewNewsAuditEntry } from './previewAudit';

const markdownCounts = (title: string, counts: Record<string, number>) => [
  `## ${title}`,
  '',
  '| Value | Count |',
  '|---|---:|',
  ...Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => `| ${key} | ${count} |`),
  '',
];

const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;

export const buildNewsAuditMarkdown = (
  summary: NewsAuditSummary,
  entries: NewsAuditEntry[],
  rankingEntries: RankingNewsAuditEntry[] = [],
  previewEntries: PreviewNewsAuditEntry[] = [],
) => {
  const lines = [
    '# League News Editorial Audit',
    '',
    `Corpus checksum: \`${summary.checksum}\``,
    '',
    `NewsItem checksum: \`${summary.newsItemChecksum}\``,
    '',
    `Preseason item checksum: \`${summary.previewItemChecksum}\``,
    '',
    `News content checksum: \`${summary.newsContentChecksum}\``,
    '',
    `Game content checksum: \`${summary.gameContentChecksum}\``,
    '',
    `Editorial outcome checksum: \`${summary.editorialOutcomeChecksum}\``,
    '',
    `Simulated stories: ${summary.counts.simulated}; scenario stories: ${summary.counts.scenarios}.`,
    '',
    '## Review rubric',
    '',
    'Review factual support, editorial angle priority, natural sports-desk voice, headline/deck repetition, and national-feed balance. Reference audit IDs in every finding.',
    '',
    '## Structural violations',
    '',
    ...(summary.violations.length ? summary.violations.map(entry => `- **${entry.code}:** ${entry.message}`) : ['- None.']),
    '',
    '## Editorial warnings',
    '',
    ...(summary.warnings.length ? summary.warnings.map(entry => `- **${entry.code}:** ${entry.message} (${entry.storyIds.length} stories)`) : ['- None.']),
    '',
    ...markdownCounts('Primary angles', summary.metrics.primaryAngles),
    ...markdownCounts('Game types', summary.metrics.gameTypes),
    ...markdownCounts('Deck rules', summary.metrics.deckRules),
    ...markdownCounts('Headline syntax families', summary.metrics.headlineSyntaxFamilies),
    ...markdownCounts('Deck syntax families', summary.metrics.deckSyntaxFamilies),
    ...markdownCounts('Score placement', summary.metrics.scoreLocations),
    ...markdownCounts('Headline/deck fact overlap', summary.metrics.headlineDeckFactOverlap),
    '## Newsworthiness dimensions',
    '',
    '| Dimension | Min | Median | P95 | Max | Mean |',
    '|---|---:|---:|---:|---:|---:|',
    ...Object.entries(summary.metrics.dimensionScores).map(([dimension, values]) =>
      `| ${dimension} | ${values.min} | ${values.median} | ${values.p95} | ${values.max} | ${values.mean} |`
    ),
    '',
    ...markdownCounts('Story rank tiers', summary.metrics.storyRankTiers),
    ...markdownCounts('Weekly top-five rank tiers', summary.metrics.weeklyTopFiveRankTiers),
    ...markdownCounts('Weekly lead rank tiers', summary.metrics.weeklyLeadRankTiers),
    '## National front-page composition',
    '',
    `- Ranked top-five slots: ${summary.metrics.frontPageComposition.rankedTopFiveSlots}/${summary.metrics.frontPageComposition.topFiveSlots} (${percentage(summary.metrics.frontPageComposition.rankedTopFiveRate)})`,
    `- Ranked leads: ${summary.metrics.frontPageComposition.rankedLeads}/${summary.metrics.frontPageComposition.leads} (${percentage(summary.metrics.frontPageComposition.rankedLeadRate)})`,
    `- Unranked-only leads: ${summary.metrics.frontPageComposition.unrankedLeadIds.length}`,
    `- Unranked-only leads below 20 drama points: ${summary.metrics.frontPageComposition.unrankedLeadWithoutDramaIds.length}`,
    `- Top-five slots changed from v3 scoring: ${summary.metrics.v3FrontPageComparison.changedTopFiveSlots}/${summary.metrics.v3FrontPageComparison.totalTopFiveSlots} (${percentage(summary.metrics.v3FrontPageComparison.changedTopFiveRate)})`,
    `- Changed leads from v3 scoring: ${summary.metrics.v3FrontPageComparison.changedLeadIds.length}`,
    '',
    ...markdownCounts('Featured positions', summary.metrics.featuredPositions),
    ...markdownCounts('Weekly top-five conferences', summary.metrics.weeklyTopFiveConferences),
    ...markdownCounts('Combined contexts', summary.metrics.combinedContexts),
    '## Rankings publisher',
    '',
    `- Audit cases: ${summary.rankingAudit.cases}`,
    `- Published stories: ${summary.rankingAudit.published} (${percentage(summary.rankingAudit.publicationRate)})`,
    `- Structural violations: ${summary.rankingAudit.violations.length}`,
    `- Ranking stories in weekly top fives: ${summary.rankingAudit.mixedFrontPage.rankingSlots}/${summary.rankingAudit.mixedFrontPage.topFiveSlots}`,
    `- Ranking-story leads: ${summary.rankingAudit.mixedFrontPage.rankingLeads}`,
    `- Mixed-feed ranked top-five participation: ${percentage(summary.rankingAudit.mixedFrontPage.rankedParticipationRate)}`,
    `- Mixed-feed ranked leads: ${percentage(summary.rankingAudit.mixedFrontPage.rankedLeadRate)}`,
    '',
    ...markdownCounts('Ranking angles', summary.rankingAudit.angles),
    ...markdownCounts('Ranking headline templates', summary.rankingAudit.headlineTemplates),
    ...markdownCounts('Ranking deck templates', summary.rankingAudit.deckTemplates),
    '### Ranking samples',
    '',
    ...rankingEntries.filter(entry => entry.item).slice(0, 12).map(entry =>
      `- \`${entry.auditId}\` (${entry.item!.importance}) ${entry.item!.headline} — ${entry.item!.deck}`),
    '',
    '## Preseason publisher',
    '',
    `- Audit cases: ${summary.previewAudit.cases}`,
    `- Published stories: ${summary.previewAudit.published}`,
    `- Structural violations: ${summary.previewAudit.violations.length}`,
    '',
    ...markdownCounts('Preseason angles', summary.previewAudit.angles),
    ...markdownCounts('Preseason headline templates', summary.previewAudit.headlineTemplates),
    ...markdownCounts('Preseason deck templates', summary.previewAudit.deckTemplates),
    '### Preseason samples',
    '',
    ...previewEntries.slice(0, 4).flatMap(entry => entry.stories.map(({ item }) =>
      `- \`${entry.auditId}:${item.primaryAngle}\` (${item.importance}) ${item.headline} — ${item.deck}`)),
    '',
    '## Weekly front pages',
    '',
  ];
  const natural = entries.filter(entry => entry.source === 'simulation');
  const weekKeys = [...new Set(natural.map(entry =>
    `${entry.rootSeed}:${entry.sample}:${entry.item.year}:${entry.item.week}`,
  ))].sort().slice(0, 6);
  weekKeys.forEach(key => {
    const stories = sortNewsItems(natural
      .filter(entry => `${entry.rootSeed}:${entry.sample}:${entry.item.year}:${entry.item.week}` === key)
      .map(entry => ({
        ...entry,
        id: entry.item.id,
        type: entry.item.type,
        importance: entry.item.importance,
        gameId: entry.item.gameId,
      })))
      .slice(0, 5);
    lines.push(`### ${key}`, '');
    stories.forEach(entry => lines.push(
      `- \`${entry.auditId}\` (${entry.item.importance}) ${entry.item.headline} — ${entry.item.deck}`,
    ));
    lines.push('');
  });
  const byAuditId = new Map(entries.map(entry => [entry.auditId, entry]));
  lines.push('## Importance outliers', '', '### Highest', '');
  summary.metrics.highestImportanceIds.forEach(id => {
    const entry = byAuditId.get(id);
    if (entry) lines.push(`- \`${id}\` (${entry.item.importance}) ${entry.item.headline}`);
  });
  lines.push('', '### Lowest', '');
  summary.metrics.lowestImportanceIds.forEach(id => {
    const entry = byAuditId.get(id);
    if (entry) lines.push(`- \`${id}\` (${entry.item.importance}) ${entry.item.headline}`);
  });
  lines.push('', '## Representative samples by primary angle', '');
  (GAME_STORY_ANGLES as readonly GameStoryAngle[]).forEach(angle => {
    lines.push(`### ${angle}`, '');
    entries.filter(entry => entry.item.primaryAngle === angle).slice(0, 5).forEach(entry => {
      lines.push(`- \`${entry.auditId}\` [${entry.source}; ${entry.trace.templateId}/${entry.trace.deckRuleId}] ${entry.item.headline} — ${entry.item.deck}`);
    });
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
};
