import { pathToFileURL } from 'node:url';
import {
  collectPerformanceIndexAudit,
  evaluatePerformanceIndexAudit,
  PERFORMANCE_INDEX_AUDIT_SEED,
  PERFORMANCE_INDEX_AUDIT_SEEDS,
} from './evaluation/performanceIndex/evaluation';
import { loadSeasonCorpusData } from './evaluation/shared/seasonCorpusData';

export const runPerformanceIndexAudit = () => {
  const data = loadSeasonCorpusData(2026);
  const counts = collectPerformanceIndexAudit(
    data,
    PERFORMANCE_INDEX_AUDIT_SEED,
    PERFORMANCE_INDEX_AUDIT_SEEDS,
  );
  const replayExpected = collectPerformanceIndexAudit(
    data,
    PERFORMANCE_INDEX_AUDIT_SEED,
    1,
  );
  const replayActual = collectPerformanceIndexAudit(
    data,
    PERFORMANCE_INDEX_AUDIT_SEED,
    1,
  );
  const summary = evaluatePerformanceIndexAudit(
    counts,
    JSON.stringify(replayExpected) === JSON.stringify(replayActual),
  );
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.passed ? undefined : 1;
  return summary;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPerformanceIndexAudit();
}
