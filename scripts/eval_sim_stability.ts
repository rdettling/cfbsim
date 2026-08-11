import { pathToFileURL } from 'node:url';
import {
  parseStabilityAuditArguments,
  runCalibrationStabilityAudit,
  stabilityAuditExitCode,
} from '../src/domain/sim/stabilityAudit';

export const runSimulationStabilityAudit = (arguments_: string[]) => {
  const result = runCalibrationStabilityAudit(parseStabilityAuditArguments(arguments_));
  console.log(JSON.stringify(result, null, 2));
  if (stabilityAuditExitCode(result)) process.exitCode = 1;
  return result;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSimulationStabilityAudit(process.argv.slice(2));
}
