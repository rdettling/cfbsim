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
    baseCompPercent: number;
    baseSackRate: number;
    baseIntRate: number;
    baseFumbleRate: number;
    compRateAdvantageFactor: number;
    riskAdvantageFactor: number;
    advantageScale: number;
    pass: {
      baseMean: number;
      stdDev: number;
      advantageFactor: number;
      positiveMultiplier: number;
    };
    run: {
      baseMean: number;
      stdDev: number;
      advantageFactor: number;
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
