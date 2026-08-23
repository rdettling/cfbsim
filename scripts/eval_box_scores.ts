import { pathToFileURL } from 'node:url';
import {
  evaluateRepresentativeBoxScores,
  parseRepresentativeBoxScoreArguments,
} from './evaluation/sim/representativeEvaluation';

export const runRepresentativeBoxScoreEvaluation = (arguments_: string[]) => {
  const result = evaluateRepresentativeBoxScores(
    parseRepresentativeBoxScoreArguments(arguments_),
  );
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode || undefined;
  return result;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRepresentativeBoxScoreEvaluation(process.argv.slice(2));
}
