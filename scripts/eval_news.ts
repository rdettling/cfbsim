import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ConferencesData, TeamsData, YearData } from '../src/types/baseData';
import type { WeightedNameData } from '../src/types/recruiting';
import {
  checksumValues,
  evaluateNewsAudit,
  type NewsAuditNotice,
} from '../src/domain/news/audit';
import {
  evaluateRankingNewsAudit,
  evaluateMixedNewsFrontPages,
  hasRankingAngleCoverage,
  type RankingNewsAuditEntry,
} from '../src/domain/news/rankingAudit';
import { RANKING_STORY_ANGLES } from '../src/types/news';
import {
  evaluatePreviewNewsAudit,
  type PreviewNewsAuditEntry,
} from '../src/domain/news/previewAudit';
import { buildNewsAuditMarkdown } from '../src/domain/news/auditReport';
import {
  generateNewsAuditCorpus,
  type NewsAuditCorpusData,
} from '../src/domain/news/corpus';
import { newsAuditExitCode, parseNewsAuditArguments } from '../src/domain/news/auditCli';
import { normalizeRivalriesData } from '../src/domain/rivalryData';

const START_YEAR = 2026;

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;


const loadCorpusData = (): NewsAuditCorpusData => {
  const teamsData = readJson<TeamsData>('../public/data/teams.json');
  return {
    yearData: readJson<YearData>('../public/data/years/2026.json'),
    teamsData,
    conferencesData: readJson<ConferencesData>('../public/data/conferences.json'),
    names: readJson<WeightedNameData>('../public/data/names.json'),
    states: readJson<Record<string, number>>('../public/data/states.json'),
    rivalries: normalizeRivalriesData(
      readJson<unknown>('../public/data/rivalries.json'),
      new Set(Object.keys(teamsData.teams)),
    ),
    bettingOdds: readJson<unknown>('../public/data/betting_odds.json'),
  };
};

export const runNewsAudit = (arguments_: string[]) => {
  const options = parseNewsAuditArguments(arguments_);
  const data = loadCorpusData();
  const rankingEntries: RankingNewsAuditEntry[] = [];
  const previewEntries: PreviewNewsAuditEntry[] = [];
  const entries = generateNewsAuditCorpus(data, {
    seed: options.seed,
    seeds: options.seeds,
    seasons: options.seasons,
    startYear: START_YEAR,
  }, rankingEntries, previewEntries);
  const configuration = {
    seed: options.seed,
    seeds: options.seeds,
    seasons: options.seasons,
    replaySeeds: options.replaySeeds,
    startYear: START_YEAR,
  };
  const summary = evaluateNewsAudit(entries, configuration);
  summary.rankingAudit = evaluateRankingNewsAudit(rankingEntries);
  summary.previewAudit = evaluatePreviewNewsAudit(previewEntries);
  summary.rankingAudit.mixedFrontPage = evaluateMixedNewsFrontPages(entries, rankingEntries);
  summary.counts.rankingCases = summary.rankingAudit.cases;
  summary.counts.rankingPublished = summary.rankingAudit.published;
  summary.counts.previewCases = summary.previewAudit.cases;
  summary.counts.previewPublished = summary.previewAudit.published;
  summary.counts.total += summary.rankingAudit.cases + summary.previewAudit.cases;
  summary.checksum = checksumValues([...entries, ...rankingEntries, ...previewEntries]);
  summary.newsItemChecksum = checksumValues([
    ...entries.map(entry => entry.item),
    ...rankingEntries.flatMap(entry => entry.item ? [entry.item] : []),
    ...previewEntries.flatMap(entry => entry.stories.map(story => story.item)),
  ]);
  summary.previewItemChecksum = checksumValues(
    previewEntries.flatMap(entry => entry.stories.map(story => story.item)),
  );
  for (const violation of summary.rankingAudit.violations) {
    summary.violations.push({
      code: violation.code,
      message: 'A rankings audit case failed structural validation.',
      storyIds: violation.storyIds,
    });
  }
  for (const angle of RANKING_STORY_ANGLES) {
    if (!hasRankingAngleCoverage(summary.rankingAudit, angle)) {
      summary.violations.push({
        code: 'missing_ranking_angle_coverage',
        message: `The rankings audit has no ${angle} story.`,
        storyIds: [],
      });
    }
  }
  for (const violation of summary.previewAudit.violations) {
    summary.violations.push({
      code: violation.code,
      message: 'A preseason preview audit case failed structural validation.',
      storyIds: violation.storyIds,
    });
  }
  const representative = options.seeds >= 3 && options.seasons >= 2 && options.replaySeeds >= 1;
  const mixed = summary.rankingAudit.mixedFrontPage;
  if (representative &&
    (mixed.rankedParticipationRate < 0.85 || mixed.rankedParticipationRate > 0.92)) {
    summary.warnings.push({
      code: 'mixed_ranked_top_five_profile',
      message: `Mixed-feed ranked participation is ${(mixed.rankedParticipationRate * 100).toFixed(1)}%; expected 85–92%.`,
      storyIds: [],
    });
  }
  if (representative && (mixed.rankedLeadRate < 0.93 || mixed.rankedLeadRate > 0.98)) {
    summary.warnings.push({
      code: 'mixed_ranked_lead_profile',
      message: `Mixed-feed ranked leads are ${(mixed.rankedLeadRate * 100).toFixed(1)}%; expected 93–98%.`,
      storyIds: [],
    });
  }
  if (mixed.unrankedLeadWithoutDramaIds.length) {
    summary.warnings.push({
      code: 'mixed_unranked_lead_without_drama',
      message: 'A mixed-feed unranked-only lead has fewer than 20 drama points.',
      storyIds: mixed.unrankedLeadWithoutDramaIds,
    });
  }
  for (let index = 0; index < options.replaySeeds; index += 1) {
    const replaySeed = (options.seed + index) >>> 0;
    const original = entries.filter(entry =>
      entry.source === 'simulation' && entry.rootSeed === replaySeed,
    );
    const replay = generateNewsAuditCorpus(data, {
      seed: replaySeed,
      seeds: 1,
      seasons: options.seasons,
      startYear: START_YEAR,
    }).filter(entry => entry.source === 'simulation');
    const normalizedOriginal = original.map(entry => ({
      ...entry,
      auditId: entry.auditId.replace(
        `sim:${replaySeed}:${index}:`,
        `sim:${replaySeed}:0:`,
      ),
      sample: 0,
    }));
    const originalChecksum = evaluateNewsAudit(normalizedOriginal, { ...configuration, seed: replaySeed, seeds: 1 }).checksum;
    const replayChecksum = evaluateNewsAudit(replay, { ...configuration, seed: replaySeed, seeds: 1 }).checksum;
    if (originalChecksum !== replayChecksum) {
      const violation: NewsAuditNotice = {
        code: 'replay_checksum_mismatch',
        message: `Seed ${replaySeed} produced ${originalChecksum} and ${replayChecksum}.`,
        storyIds: [],
      };
      summary.violations.push(violation);
    }
  }

  const output = resolve(options.output);
  mkdirSync(output, { recursive: true });
  const summaryPath = resolve(output, 'summary.json');
  const storiesPath = resolve(output, 'stories.jsonl');
  const reviewPath = resolve(output, 'review.md');
  const previewStoryRecords = previewEntries.flatMap(entry => entry.stories.map(story => ({
    auditId: `${entry.auditId}:${story.item.primaryAngle}`,
    source: entry.source,
    rootSeed: entry.rootSeed,
    sample: entry.sample,
    season: entry.season,
    year: entry.year,
    item: story.item,
    trace: story.trace,
    expected: {
      featuredTeamIds: entry.expected.teamIds[story.item.primaryAngle],
      featuredGameId: story.item.primaryAngle === 'marquee_opener'
        ? entry.expected.featuredGameId
        : null,
      components: entry.expected.components[story.item.primaryAngle],
    },
    deterministic: entry.deterministic,
  })));
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(storiesPath, `${[...entries, ...rankingEntries, ...previewStoryRecords]
    .sort((left, right) => left.auditId.localeCompare(right.auditId))
    .map(entry => JSON.stringify(entry)).join('\n')}\n`);
  writeFileSync(reviewPath, buildNewsAuditMarkdown(
    summary,
    entries,
    rankingEntries,
    previewEntries,
  ));

  console.log(JSON.stringify({
    checksum: summary.checksum,
    newsItemChecksum: summary.newsItemChecksum,
    previewItemChecksum: summary.previewItemChecksum,
    newsContentChecksum: summary.newsContentChecksum,
    editorialOutcomeChecksum: summary.editorialOutcomeChecksum,
    counts: summary.counts,
    violations: summary.violations.length,
    warnings: summary.warnings.length,
    files: { summary: summaryPath, stories: storiesPath, review: reviewPath },
  }, null, 2));
  if (newsAuditExitCode(summary)) process.exitCode = 1;
  return { summary, entries };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNewsAudit(process.argv.slice(2));
}
