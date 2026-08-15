import type { AwardEvaluationProfile } from './awardEvaluation';

export interface AwardEvaluationCliOptions {
  profile: AwardEvaluationProfile;
  seed: number;
  output: string;
}

export const AWARD_EVALUATION_PROFILES = {
  smoke: { seeds: 1, seasons: 1, replaySeeds: 0, balance: false },
  iterate: { seeds: 3, seasons: 2, replaySeeds: 0, balance: true },
  acceptance: { seeds: 10, seasons: 2, replaySeeds: 2, balance: true },
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

export const parseAwardEvaluationArguments = (arguments_: string[]): AwardEvaluationCliOptions => {
  const options: AwardEvaluationCliOptions = {
    profile: 'iterate',
    seed: 20260815,
    output: '.artifacts/awards-audit',
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
    } else throw new Error(`Unknown awards evaluation argument: ${name ?? '(missing)'}.`);
  }
  return options;
};

const FAMILY_SALTS = {
  smoke: 0x51f15e5d,
  iterate: 0x1b873593,
  acceptance: 0x85ebca6b,
} as const;

export const deriveAwardSeedFamily = (
  profile: AwardEvaluationProfile,
  seed: number,
): number[] => {
  const count = AWARD_EVALUATION_PROFILES[profile].seeds;
  const base = (Math.imul(seed ^ FAMILY_SALTS[profile], 0x9e3779b1) >>> 0);
  return Array.from({ length: count }, (_, index) => (base + index * 0x10001) >>> 0);
};
