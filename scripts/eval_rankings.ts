import { pathToFileURL } from 'node:url';
import { loadSeasonBalanceHistoricalReference } from './evaluation/seasonBalance/historicalReference';
import {
  collectRankingAudit,
  evaluateRankingAudit,
  RANKING_AUDIT_SEED,
  RANKING_AUDIT_SEEDS,
} from './evaluation/rankings/evaluation';
import { loadSeasonCorpusData } from './evaluation/shared/seasonCorpusData';

export const runRankingAudit = () => {
  const data = loadSeasonCorpusData(2026);
  const artifact = collectRankingAudit(
    data,
    RANKING_AUDIT_SEED,
    RANKING_AUDIT_SEEDS,
  );
  const expectedWeek14Top25AverageLosses =
    loadSeasonBalanceHistoricalReference().modern.top25TwelveGameEquivalentLosses;
  const replayExpected = collectRankingAudit(data, RANKING_AUDIT_SEED, 1);
  const replayActual = collectRankingAudit(data, RANKING_AUDIT_SEED, 1);
  const summary = evaluateRankingAudit({
    artifact,
    expectedWeek14Top25AverageLosses,
    replayMatches: JSON.stringify(replayExpected) === JSON.stringify(replayActual),
  });
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.passed ? undefined : 1;
  return summary;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRankingAudit();
}
