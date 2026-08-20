export interface SimulationEvaluationOptions {
  seed: number;
  gamesPerDiff: number;
}

const parseInteger = (
  name: string,
  value: string | undefined,
  minimum: number,
  maximum: number,
) => {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return parsed;
};

export const parseSimulationEvaluationArguments = (
  arguments_: string[],
): SimulationEvaluationOptions => {
  const options: SimulationEvaluationOptions = {
    seed: 20260809,
    gamesPerDiff: 1000,
  };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--seed') options.seed = parseInteger(name, value, 1, 0xffff_ffff);
    else if (name === '--games-per-diff') {
      options.gamesPerDiff = parseInteger(name, value, 1, 100_000);
    } else throw new Error(`Unknown simulation evaluation argument: ${name ?? '(missing)'}.`);
  }
  return options;
};

export const simulationEvaluationExitCode = (
  summary: { violations: readonly unknown[] },
) => summary.violations.length ? 1 : 0;
