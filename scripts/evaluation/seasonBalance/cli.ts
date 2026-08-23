export type SeasonBalanceProfile = 'smoke' | 'iterate' | 'acceptance';

export interface SeasonBalanceCliOptions {
  profile: SeasonBalanceProfile;
  seed: number;
  output: string;
}

export const SEASON_BALANCE_PROFILES = {
  smoke: { seeds: 1, replaySeeds: 0 },
  iterate: { seeds: 10, replaySeeds: 0 },
  acceptance: { seeds: 40, replaySeeds: 1 },
} as const;

const parseSeed = (value: string | undefined) => {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error('--seed must be an integer from 0 through 4294967295.');
  }
  const parsed = Number(value);
  if (parsed < 0 || parsed > 0xffff_ffff) {
    throw new Error('--seed must be an integer from 0 through 4294967295.');
  }
  return parsed;
};

export const parseSeasonBalanceArguments = (
  arguments_: string[],
): SeasonBalanceCliOptions => {
  const options: SeasonBalanceCliOptions = {
    profile: 'iterate',
    seed: 20260822,
    output: '.artifacts/season-balance',
  };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--profile') {
      if (value !== 'smoke' && value !== 'iterate' && value !== 'acceptance') {
        throw new Error('--profile must be smoke, iterate, or acceptance.');
      }
      options.profile = value;
    } else if (name === '--seed') options.seed = parseSeed(value);
    else if (name === '--output') {
      if (!value?.trim()) throw new Error('--output must be a nonempty path.');
      options.output = value;
    } else {
      throw new Error(`Unknown season-balance argument: ${name ?? '(missing)'}.`);
    }
  }
  return options;
};

const FAMILY_SALTS = {
  smoke: 0x3c6ef372,
  iterate: 0xa54ff53a,
  acceptance: 0x510e527f,
} as const;

export const deriveSeasonBalanceSeedFamily = (
  profile: SeasonBalanceProfile,
  seed: number,
) => {
  const base = Math.imul(seed ^ FAMILY_SALTS[profile], 0x9e3779b1) >>> 0;
  return Array.from(
    { length: SEASON_BALANCE_PROFILES[profile].seeds },
    (_, index) => (base + index * 0x10001) >>> 0,
  );
};
