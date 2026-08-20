import type { AwardEvaluationSummary, AwardSeasonEvaluation } from './evaluation';
import { AWARD_DEFINITIONS } from '../../../src/domain/league/awardDefinitions';

export const buildAwardSeasonArtifact = (season: AwardSeasonEvaluation) => ({
  seed: season.seed,
  season: season.season,
  year: season.year,
  awards: Object.fromEntries(AWARD_DEFINITIONS.map(definition => [definition.slug, {
    eligibleCandidates: season.checkpoints[15].candidates[definition.slug].length,
    winner: season.checkpoints[15].candidates[definition.slug][0] ?? null,
    week3: season.checkpoints[3].candidates[definition.slug].slice(0, 3).map(candidate => candidate.playerId),
    week9: season.checkpoints[9].candidates[definition.slug].slice(0, 3).map(candidate => candidate.playerId),
    week12: season.checkpoints[12].candidates[definition.slug].slice(0, 3).map(candidate => candidate.playerId),
  }])),
});

export const buildAwardEvaluationMarkdown = (summary: AwardEvaluationSummary) => [
  '# Awards Calibration Audit',
  '',
  `- Status: ${summary.status}`,
  `- Profile: ${summary.profile}`,
  `- Seasons: ${summary.seasons}`,
  `- Checksum: ${summary.checksum}`,
  `- Exit code: ${summary.exitCode}`,
  '',
  '## Balance gaps',
  '',
  ...(summary.gaps.length ? summary.gaps.map(gap =>
    `- ${gap.metric}: ${gap.observed} (target ${gap.target.minimum ?? '-∞'}–${gap.target.maximum ?? '∞'})`,
  ) : ['- None']),
  '',
  '## Agent recommendations',
  '',
  ...(summary.recommendations.length ? summary.recommendations.map(recommendation =>
    `- ${recommendation.rank}. ${recommendation.configPath ?? 'ESCALATE'}: ${recommendation.direction} ${recommendation.suggestedDelta ?? ''} — ${recommendation.evidence}`,
  ) : ['- None']),
  '',
  `Next: \`${summary.nextCommand}\``,
  '',
].join('\n');
