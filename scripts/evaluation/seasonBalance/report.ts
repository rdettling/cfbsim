import type {
  SeasonBalanceSeasonArtifact,
  SeasonBalanceSummary,
} from './evaluation';

const targetRange = (minimum?: number, maximum?: number) =>
  `${minimum ?? '-∞'}–${maximum ?? '∞'}`;

export const buildSeasonBalanceMarkdown = (summary: SeasonBalanceSummary) => [
  '# Season Competitive Balance Audit',
  '',
  `- Status: ${summary.status}`,
  `- Profile: ${summary.profile}`,
  `- Seasons: ${summary.seasons}`,
  `- Checksum: ${summary.checksum}`,
  `- Exit code: ${summary.exitCode}`,
  '',
  '## Elite balance',
  '',
  '| Metric | Observed | Target |',
  '| --- | ---: | ---: |',
  ...summary.targets
    .filter(target => target.kind === 'elite_balance')
    .map(target => `| ${target.metric} | ${summary.metrics[target.metric]} | ${targetRange(target.minimum, target.maximum)} |`),
  `| meanTopRatedExpectedLosses | ${summary.metrics.meanTopRatedExpectedLosses} | diagnostic ${targetRange(summary.diagnostics.strongestTeamExpectedLossRange.minimum, summary.diagnostics.strongestTeamExpectedLossRange.maximum)} |`,
  `| meanNumberOneLosses | ${summary.metrics.meanNumberOneLosses} | diagnostic only |`,
  '',
  '## Ranked-record diagnostics',
  '',
  '| Metric | Observed | Context range |',
  '| --- | ---: | ---: |',
  ...summary.targets
    .filter(target => target.kind === 'ranked_record_diagnostic')
    .map(target => `| ${target.metric} | ${summary.metrics[target.metric]} | ${targetRange(target.minimum, target.maximum)} |`),
  '',
  'These ranges describe ranked records but cannot create an acceptance gap.',
  '',
  '## Probability and Prestige 7 diagnostics',
  '',
  '| Metric | Observed |',
  '| --- | ---: |',
  `| meanOddsImpliedUndefeatedTeams | ${summary.metrics.meanOddsImpliedUndefeatedTeams} |`,
  `| meanOddsImpliedOneLossOrBetterTeams | ${summary.metrics.meanOddsImpliedOneLossOrBetterTeams} |`,
  `| meanPrestige7Rating | ${summary.metrics.meanPrestige7Rating} |`,
  `| meanPrestige7RatingStandardDeviation | ${summary.metrics.meanPrestige7RatingStandardDeviation} |`,
  `| meanPrestige7Losses | ${summary.metrics.meanPrestige7Losses} |`,
  `| meanPrestige7LossStandardDeviation | ${summary.metrics.meanPrestige7LossStandardDeviation} |`,
  `| meanPrestige7OneLossOrBetterTeams | ${summary.metrics.meanPrestige7OneLossOrBetterTeams} |`,
  `| meanPrestige7OneLossOrBetterShare | ${summary.metrics.meanPrestige7OneLossOrBetterShare} |`,
  '',
  '## National margin guardrails',
  '',
  '| Metric | Observed | Target |',
  '| --- | ---: | ---: |',
  ...summary.targets
    .filter(target => target.kind === 'national_margin_guardrail')
    .map(target => `| ${target.metric} | ${summary.metrics[target.metric]} | ${targetRange(target.minimum, target.maximum)} |`),
  '',
  '## Historical context',
  '',
  `Modern bundled FBS-only reference (${summary.historicalReference.modern.years.join(', ')}):`,
  '',
  `- Undefeated teams per season: ${summary.historicalReference.modern.meanUndefeatedTeams}`,
  `- Teams with zero or one loss: ${summary.historicalReference.modern.meanOneLossOrBetterTeams}`,
  `- Top 5 / 10 / 25 average losses: ${summary.historicalReference.modern.top5AverageLosses} / ${summary.historicalReference.modern.top10AverageLosses} / ${summary.historicalReference.modern.top25AverageLosses}`,
  `- Top 5 / 10 / 25 twelve-game-equivalent losses: ${summary.historicalReference.modern.top5TwelveGameEquivalentLosses} / ${summary.historicalReference.modern.top10TwelveGameEquivalentLosses} / ${summary.historicalReference.modern.top25TwelveGameEquivalentLosses}`,
  `- Average FBS games per eligible team: ${summary.historicalReference.modern.averageFbsGames}`,
  '',
  `Broad bundled reference (${summary.historicalReference.all.years.join(', ')}): ` +
    `${summary.historicalReference.all.meanUndefeatedTeams} undefeated and ` +
    `${summary.historicalReference.all.meanOneLossOrBetterTeams} zero-or-one-loss teams per season.`,
  '',
  'The undefeated and zero-or-one-loss counts are raw upper context because real teams average fewer than twelve FBS games. Twelve-game-equivalent ranked losses scale each team independently by its FBS games; they do not alter real records.',
  '',
  '| Year | FBS games | Undefeated | Zero or one loss | Top 5 losses | Top 5 losses / 12 |',
  '| ---: | ---: | ---: | ---: | ---: | ---: |',
  ...summary.historicalReference.bySeason.map(row =>
    `| ${row.year} | ${row.averageFbsGames} | ${row.undefeatedTeams} | ${row.oneLossOrBetterTeams} | ${row.top5AverageLosses} | ${row.top5TwelveGameEquivalentLosses} |`),
  '',
  '## Gaps',
  '',
  ...(summary.gaps.length
    ? summary.gaps.map(gap => `- ${gap.evidence}`)
    : ['- None']),
  '',
  '## Diagnostic gaps',
  '',
  ...(summary.diagnosticGaps.length
    ? summary.diagnosticGaps.map(gap => `- ${gap.evidence}`)
    : ['- None']),
  '',
  '## Integrity',
  '',
  ...(summary.structuralViolations.length
    ? summary.structuralViolations.map(violation => `- ${violation}`)
    : ['- Structural violations: none']),
  ...(summary.replayChecks.length
    ? summary.replayChecks.map(check => `- Replay ${check.seed}: ${check.matches ? 'match' : 'mismatch'} (${check.expected}/${check.actual})`)
    : ['- Replay checks: not required for this profile']),
  '',
  `Next: \`${summary.nextCommand}\``,
  '',
].join('\n');

export const serializeSeasonBalanceArtifact = (
  artifact: SeasonBalanceSeasonArtifact,
) => JSON.stringify(artifact);
