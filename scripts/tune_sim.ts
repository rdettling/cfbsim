import { pathToFileURL } from 'node:url';
import {
  parseSimulationTuningArguments,
  searchSimulationTuning,
} from './evaluation/sim/tuner';

export const runSimulationTuner = (arguments_: string[]) => {
  const result = searchSimulationTuning(parseSimulationTuningArguments(arguments_));
  console.log(JSON.stringify(result, null, 2));
  return result;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSimulationTuner(process.argv.slice(2));
}
