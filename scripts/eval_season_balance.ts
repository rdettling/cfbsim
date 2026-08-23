import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  deriveSeasonBalanceSeedFamily,
  parseSeasonBalanceArguments,
  SEASON_BALANCE_PROFILES,
} from './evaluation/seasonBalance/cli';
import {
  artifactChecksum,
  collectSeasonBalanceArtifact,
  evaluateSeasonBalance,
  type SeasonBalanceReplay,
  type SeasonBalanceSeasonArtifact,
} from './evaluation/seasonBalance/evaluation';
import { loadSeasonBalanceHistoricalReference } from './evaluation/seasonBalance/historicalReference';
import {
  buildSeasonBalanceMarkdown,
  serializeSeasonBalanceArtifact,
} from './evaluation/seasonBalance/report';
import { loadSeasonCorpusData } from './evaluation/shared/seasonCorpusData';

const START_YEAR = 2026;

export const runSeasonBalanceEvaluation = (arguments_: string[]) => {
  const options = parseSeasonBalanceArguments(arguments_);
  const profile = SEASON_BALANCE_PROFILES[options.profile];
  const seeds = deriveSeasonBalanceSeedFamily(options.profile, options.seed);
  const data = loadSeasonCorpusData(START_YEAR);
  const artifacts: SeasonBalanceSeasonArtifact[] = [];
  const structuralViolations: string[] = [];
  seeds.forEach(seed => {
    const collected = collectSeasonBalanceArtifact(data, seed);
    artifacts.push(collected.artifact);
    structuralViolations.push(...collected.violations);
  });
  const replayChecks: SeasonBalanceReplay[] = seeds
    .slice(0, profile.replaySeeds)
    .map(seed => {
      const expectedArtifact = artifacts.find(artifact => artifact.seed === seed)!;
      const replay = collectSeasonBalanceArtifact(data, seed);
      structuralViolations.push(...replay.violations.map(violation => `replay:${violation}`));
      const expected = artifactChecksum(expectedArtifact);
      const actual = artifactChecksum(replay.artifact);
      return { seed, expected, actual, matches: expected === actual };
    });
  const summary = evaluateSeasonBalance({
    artifacts,
    historicalReference: loadSeasonBalanceHistoricalReference(),
    profile: options.profile,
    replayChecks,
    structuralViolations,
  });

  const output = resolve(options.output);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(
    resolve(output, 'seasons.jsonl'),
    `${artifacts.map(serializeSeasonBalanceArtifact).join('\n')}\n`,
  );
  writeFileSync(resolve(output, 'review.md'), buildSeasonBalanceMarkdown(summary));
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.exitCode || undefined;
  return { summary, artifacts };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeasonBalanceEvaluation(process.argv.slice(2));
}
