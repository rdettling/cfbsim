import raw from './tuning.json';

export type SimTuning = {
  clock: {
    tempoMultipliers: {
      fast: number;
      chew: number;
      normal: number;
    };
    playSeconds: {
      run: { min: number; max: number };
      passComplete: { min: number; max: number };
      passIncomplete: { min: number; max: number };
      specialTeams: { min: number; max: number };
    };
    firstDownStopSeconds: number;
    outOfBoundsStop: {
      firstHalfSeconds: number;
      secondHalfSeconds: number;
    };
  };
  kickoffs: {
    touchbackRate: number;
    touchbackSpot: number;
    returnMin: number;
    returnMax: number;
  };
  playcalling: {
    passWeightBase: number;
    passWeightThirdAndLong: number;
    passWeightShortYards: number;
    passWeightLateTrailing: number;
    passWeightLateLeading: number;
    passWeightMin: number;
    passWeightMax: number;
  };
  outcomes: {
    passPositivePower: number;
    runPositivePower: number;
    baseCompPercent: number;
    baseSackRate: number;
    baseIntRate: number;
    baseFumbleRate: number;
    executionDiffDivisor: number;
    yardsDiffDivisor: number;
    pass: {
      baseMean: number;
      stdDev: number;
      positiveMultiplier: number;
    };
    run: {
      baseMean: number;
      stdDev: number;
      positiveMultiplier: number;
    };
    sack: {
      baseMean: number;
      stdDev: number;
    };
    fieldGoal: {
      goodFrom: number;
      maxRange: number;
      baseProb: number;
      slope: number;
      longProb: number;
      longSlope: number;
    };
  };
};

export const SIM_TUNING = raw as SimTuning;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const deepAssign = (target: Record<string, unknown>, source: Record<string, unknown>) => {
  Object.entries(source).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      deepAssign(target[key] as Record<string, unknown>, value);
      return;
    }
    target[key] = value;
  });
};

export const applySimTuning = (next: SimTuning) => {
  deepAssign(SIM_TUNING as Record<string, unknown>, next as Record<string, unknown>);
};
