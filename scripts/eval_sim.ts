import { pathToFileURL } from 'node:url';
import { evaluateSimulation } from '../src/domain/sim/evaluation';
import {
  parseSimulationEvaluationArguments,
  simulationEvaluationExitCode,
} from '../src/domain/sim/evaluationCli';

export const runSimulationEvaluation = (arguments_: string[]) => {
  const summary = evaluateSimulation(parseSimulationEvaluationArguments(arguments_));
  console.log(JSON.stringify(summary, null, 2));
  if (simulationEvaluationExitCode(summary)) process.exitCode = 1;
  return summary;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSimulationEvaluation(process.argv.slice(2));
}
