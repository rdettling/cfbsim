import raw from './tuning.json';

export type SimTuning = {
  conversions: {
    extraPointMakeProbability: number;
    automaticTwoPoint: {
      lateRegulationSeconds: number;
      postTouchdownMargins: number[];
    };
  };
  defense: {
    automatic: {
      base: Record<'base' | 'loaded_box' | 'coverage' | 'pressure', number>;
      adjustments: {
        shortYardage: Record<string, number>;
        longYardage: Record<string, number>;
        redZone: Record<string, number>;
        protectingLead: Record<string, number>;
        trailingLate: Record<string, number>;
      };
    };
    matchups: Record<
      'base' | 'loaded_box' | 'coverage' | 'pressure',
      Record<
        | 'inside_run'
        | 'outside_run'
        | 'option'
        | 'quick_pass'
        | 'intermediate_pass'
        | 'deep_pass'
        | 'screen'
        | 'play_action',
        {
          meanMultiplier: number;
          stdDevMultiplier: number;
          positiveMultiplier: number;
          completionMultiplier: number;
          sackMultiplier: number;
          interceptionMultiplier: number;
          fumbleMultiplier: number;
        }
      >
    >;
  };
  concepts: {
    automatic: {
      run: Record<'inside_run' | 'outside_run' | 'option', number>;
      pass: Record<
        'quick_pass' | 'intermediate_pass' | 'deep_pass' | 'screen' | 'play_action',
        number
      >;
      adjustments: {
        shortYardage: Record<string, number>;
        longYardage: Record<string, number>;
        redZone: Record<string, number>;
        lateTrailing: Record<string, number>;
        lateLeading: Record<string, number>;
      };
    };
    run: Record<
      'inside_run' | 'outside_run' | 'option',
      {
        meanMultiplier: number;
        stdDevMultiplier: number;
        positiveMultiplier: number;
        fumbleMultiplier: number;
      }
    >;
    pass: Record<
      'quick_pass' | 'intermediate_pass' | 'deep_pass' | 'screen' | 'play_action',
      {
        meanMultiplier: number;
        stdDevMultiplier: number;
        positiveMultiplier: number;
        completionMultiplier: number;
        sackMultiplier: number;
        interceptionMultiplier: number;
      }
    >;
  };
  clock: {
    gameRunoffMultiplier: {
      minimum: number;
      maximum: number;
    };
    tempoMultipliers: {
      normal: number;
      hurry_up: number;
      chew_clock: number;
    };
    liveBallSeconds: {
      scrimmage: { min: number; max: number };
      specialTeams: { min: number; max: number };
    };
    runoffSeconds: {
      runOrSack: { min: number; max: number };
      completedPass: { min: number; max: number };
    };
    outOfBoundsRates: {
      run: number;
      pass: number;
    };
    firstDownStopSeconds: number;
    outOfBoundsStop: {
      firstHalfSeconds: number;
      secondHalfSeconds: number;
    };
    management: {
      minimumSpikeSeconds: number;
      spikeWindowSeconds: number;
      spikeLiveBallSeconds: { min: number; max: number };
      kneelLiveBallSeconds: { min: number; max: number };
      kneelBudgetSeconds: number;
      trailingOffenseTimeoutSeconds: number;
      trailingDefenseFirstHalfSeconds: number;
      fieldGoalCloseoutTargetSeconds: number;
      maximumPostPlayRunoffSeconds: number;
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
    fourthDown: {
      puntTerritoryMaxFieldPosition: number;
      midfieldMaxFieldPosition: number;
      fieldGoalRangeStartFieldPosition: number;
      midfieldGoMaxYards: number;
      opponentTerritoryGoMaxYards: number;
      fieldGoalTerritoryGoMaxYards: number;
    };
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
    redZone: {
      runPositiveYardsMultiplier: number;
      passPositiveYardsMultiplier: number;
    };
    drive: {
      thirdDownPositiveYardsMultiplier: number;
    };
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
      shortMaxDistance: number;
      shortProbability: number;
      mediumDistance: number;
      mediumProbability: number;
      longDistance: number;
      longProbability: number;
      extremeDistance: number;
      extremeProbability: number;
      minimumProbability: number;
      accuracyMultiplier: number;
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

const applySimTuning = (next: SimTuning) => {
  deepAssign(SIM_TUNING as Record<string, unknown>, next as Record<string, unknown>);
};

export const withSimTuning = <Result>(
  next: SimTuning,
  callback: () => Result,
): Result => {
  const previous = structuredClone(SIM_TUNING);
  applySimTuning(next);
  try {
    return callback();
  } finally {
    applySimTuning(previous);
  }
};
