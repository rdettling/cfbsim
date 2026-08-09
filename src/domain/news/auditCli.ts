export interface NewsAuditCliOptions {
  seed: number;
  seeds: number;
  seasons: number;
  replaySeeds: number;
  output: string;
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

export const parseNewsAuditArguments = (arguments_: string[]): NewsAuditCliOptions => {
  const options: NewsAuditCliOptions = {
    seed: 20260809,
    seeds: 1,
    seasons: 1,
    replaySeeds: 0,
    output: '.artifacts/news-audit',
  };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--seed') options.seed = parseInteger(name, value, 0, 0xffff_ffff);
    else if (name === '--seeds') options.seeds = parseInteger(name, value, 1, 100);
    else if (name === '--seasons') options.seasons = parseInteger(name, value, 1, 20);
    else if (name === '--replay-seeds') options.replaySeeds = parseInteger(name, value, 0, 100);
    else if (name === '--output') {
      if (!value?.trim()) throw new Error('--output must be a nonempty path.');
      options.output = value;
    } else throw new Error(`Unknown evaluation argument: ${name ?? '(missing)'}.`);
  }
  if (options.replaySeeds > options.seeds) {
    throw new Error('--replay-seeds cannot exceed --seeds.');
  }
  return options;
};

export const newsAuditExitCode = (summary: { violations: readonly unknown[] }) =>
  summary.violations.length ? 1 : 0;
