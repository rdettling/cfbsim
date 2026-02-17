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
    minimumPlaySeconds: {
      run: number;
      passComplete: number;
      passIncomplete: number;
      specialTeams: number;
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
    passWeightFastTempo: number;
    passWeightChewTempo: number;
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
    sackRateAdvantageFactor: number;
    compRateAdvantageFactor: number;
    intRateAdvantageFactor: number;
    fumbleRateAdvantageFactor: number;
    skillDominance: number;
    advantageScale: number;
    pass: {
      baseMean: number;
      stdDev: number;
      advantageFactor: number;
      positiveMultiplier: number;
      positivePower: number;
    };
    run: {
      baseMean: number;
      stdDev: number;
      advantageFactor: number;
      positiveMultiplier: number;
      positivePower: number;
    };
    sack: {
      baseMean: number;
      stdDev: number;
    };
    fieldGoal: {
      goodFrom: number;
      midRange: { max: number; baseProb: number; step: number };
      longRange: { max: number; baseProb: number; step: number };
      veryLong: { baseProb: number; step: number };
    };
  };
};

export const SIM_TUNING = raw as SimTuning;
