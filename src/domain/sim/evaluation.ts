import type { PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { SimGame } from '../../types/sim';
import { checksumPartitions } from '../utils/checksum';
import { createSeededRandom, withSeededMathRandom } from '../utils/random';
import {
  simGame,
} from './engine';
import {
  buildStartersCacheFromPlayers,
  createGameLogsFromPlays,
} from './statistics';
import type { SimulationEvaluationOptions } from './evaluationCli';
import { OFFENSIVE_CONCEPTS } from './concepts';
import type {
  ClockTempo,
  DefensiveIntent,
  OffensiveConcept,
  PlayRecord,
} from '../../types/db';
import { DEFENSIVE_INTENTS } from './defensiveIntents';
import { twoPointSucceeded } from './conversions';
import {
  percentile,
  populationStandardDeviation,
  SIM_CALIBRATION_BENCHMARK,
  type CalibrationTarget,
} from './calibrationBenchmark';
import {
  measureCalibration,
  type CalibrationSummary,
  type DistributionSummary,
  type RatingResult,
} from './calibrationMetrics';
import {
  auditSimulatedGame,
  evaluateDefaultSimulationGates,
} from './evaluationAudit';

const BASE_RATING = 75;
export const SIM_EVALUATION_DIFFS = [0, 7, 14, 21] as const;
export const SIM_EVALUATION_BASELINE_CHECKSUM = '1b914e9a';

const DRIVE_ENDING_CATEGORIES = [
  'touchdown',
  'punt',
  'field_goal',
  'turnover',
  'turnover_on_downs',
  'period_end',
  'other',
] as const;
type DriveEndingCategory = typeof DRIVE_ENDING_CATEGORIES[number];

type EqualTeamMetrics = {
  combinedPointsPerGame: number;
  resolvedPlaysPerGame: number;
  scrimmagePlaysPerGame: number;
  offensiveYardsPerGame: number;
  yardsPerPlay: number;
  drivesPerGame: number;
  threeAndOutsPerGame: number;
  threeAndOutRate: number;
  driveEndings: Record<DriveEndingCategory, { perGame: number; share: number }>;
  passPlayShare: number;
  completionRate: number;
  sackRate: number;
  interceptionRate: number;
  fumbleRate: number;
  rushingYardsPerAttempt: number;
  passingYardsPerAttempt: number;
  passingYardsPerCompletion: number;
  puntsPerGame: number;
  fieldGoalAttemptsPerGame: number;
  madeFieldGoalsPerGame: number;
  fieldGoalMakeRate: number;
  touchdownsPerGame: number;
  turnoversPerGame: number;
  fumblesLostPerGame: number;
  thirdDownAttemptsPerGame: number;
  thirdDownConversionRate: number;
  fourthDownAttemptsPerGame: number;
  fourthDownConversionRate: number;
  redZoneTripsPerGame: number;
  redZoneScoringRate: number;
  redZoneTouchdownRate: number;
  overtimeGameRate: number;
  fieldPosition: {
    minimum: number;
    maximum: number;
    invalidCount: number;
  };
};

type EqualTeamDistributions = {
  combinedPoints: DistributionSummary;
  margin: DistributionSummary;
  offensiveYards: DistributionSummary;
  scrimmagePlays: DistributionSummary;
  touchdowns: DistributionSummary;
  turnovers: DistributionSummary;
  punts: DistributionSummary;
  resultShares: {
    marginAtMostThree: number;
    marginAtMostEight: number;
    marginAtLeastTwenty: number;
    marginAtLeastThirty: number;
    shutout: number;
    combinedAtLeastSeventy: number;
    combinedAtMostThirty: number;
  };
};

type ConceptMetric = {
  calls: number;
  yardsPerPlay: number;
  successRate: number;
  explosiveRate: number;
  negativePlayRate: number;
  turnoverRate: number;
  fumbleRate: number;
  completionRate: number;
  sackRate: number;
  interceptionRate: number;
  yardsPerCompletion: number;
  completedPassExplosiveRate: number;
};

type ConceptMetrics = Record<OffensiveConcept, ConceptMetric>;
type DefensiveMetrics = Record<DefensiveIntent, ConceptMetric>;
type DefensiveMatchupMetrics = Record<
  DefensiveIntent,
  Record<OffensiveConcept, ConceptMetric>
>;

type TimingCategory =
  | 'run'
  | 'completedPass'
  | 'incompletePass'
  | 'sack'
  | 'specialTeams'
  | 'turnover';

type TimingCategoryMetric = {
  plays: number;
  averageLiveBallSeconds: number;
  averageElapsedSeconds: number;
};

type ClockMetrics = {
  byCategory: Record<TimingCategory, TimingCategoryMetric>;
  runningAfterShare: number;
  stoppedAfterShare: number;
  firstDownStopsPerGame: number;
  outOfBoundsStopsPerGame: number;
  twoMinuteTimeoutsPerGame: number;
  periodEventsPerGame: {
    endOfQuarter: number;
    halftime: number;
    endOfRegulation: number;
  };
  regulationTimeOfPossessionSecondsPerGame: number;
  management: {
    tempo: Record<ClockTempo, {
      plays: number;
      averageElapsedSeconds: number;
      averageRunoffSeconds: number;
    }>;
    chargedTimeoutsPerGame: number;
    offenseTimeoutsPerGame: number;
    defenseTimeoutsPerGame: number;
    firstHalfTimeoutsPerGame: number;
    secondHalfTimeoutsPerGame: number;
    spikesPerGame: number;
    kneelsPerGame: number;
    timeSavedPerGame: number;
  };
};

type TryMetrics = {
  touchdownDrives: {
    sixPoints: number;
    sevenPoints: number;
    eightPoints: number;
  };
  extraPoints: {
    attempts: number;
    made: number;
    makeRate: number;
  };
  twoPoints: {
    attempts: number;
    made: number;
    conversionRate: number;
  };
  skippedTries: number;
  automaticDecisionReasons: {
    ordinaryExtraPoint: number;
    lateRegulationTwoPoint: number;
    firstOvertimeTieTwoPoint: number;
    mandatorySecondOvertimeTwoPoint: number;
    shootoutTwoPoint: number;
  };
  overtimeGamesEndingByPeriod: Record<string, number>;
};

export interface SimulationEvaluationSummary {
  configuration: SimulationEvaluationOptions & {
    ratingDifferences: readonly number[];
    baseRating: number;
  };
  checksum: string;
  baselineChecksum: string;
  baselineApplied: boolean;
  ratingResults: RatingResult[];
  equalTeamMetrics: EqualTeamMetrics;
  equalTeamDistributions: EqualTeamDistributions;
  conceptMetrics: ConceptMetrics;
  defensiveMetrics: DefensiveMetrics;
  defensiveMatchupMetrics: DefensiveMatchupMetrics;
  clockMetrics: ClockMetrics;
  tryMetrics: TryMetrics;
  calibration: CalibrationSummary;
  calibrationGaps: string[];
  violations: string[];
}

const average = (value: number, count: number) => count ? value / count : 0;

const buildTeam = (id: number, rating: number): Team => ({
  id,
  name: `Evaluation Team ${id}`,
  abbreviation: `E${id}`,
  confGames: 0,
  confLimit: 0,
  nonConfGames: 0,
  nonConfLimit: 0,
  prestige: 0,
  ceiling: 0,
  floor: 0,
  mascot: 'Evaluators',
  city: 'Test City',
  state: 'TS',
  stadium: 'Test Stadium',
  ranking: id,
  offense: rating,
  defense: rating,
  colorPrimary: '#000000',
  colorSecondary: '#ffffff',
  conference: 'Independent',
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  rating,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0',
  movement: 0,
  poll_score: 0,
  strength_of_record: 0,
  last_game: null,
  next_game: null,
});

const buildPlayer = (
  id: number,
  teamId: number,
  pos: string,
): PlayerRecord => ({
  id,
  teamId,
  first: 'Evaluation',
  last: `Player ${id}`,
  year: 'sr',
  pos,
  rating: BASE_RATING,
  rating_fr: BASE_RATING,
  rating_so: BASE_RATING,
  rating_jr: BASE_RATING,
  rating_sr: BASE_RATING,
  stars: 3,
  development_trait: 50,
  starter: true,
});

const buildPlayers = () => {
  const positions = ['qb', 'rb', 'wr', 'te', 'ol', 'k', 'p', 'dl', 'lb', 'cb', 's'];
  let id = 1;
  return [1, 2].flatMap(teamId =>
    positions.map(position => buildPlayer(id++, teamId, position)),
  );
};

const buildLeague = (teams: Team[]): LeagueState => ({
  info: {
    currentWeek: 1,
    lastRankingsWeek: 0,
    currentYear: 2026,
    startYear: 2026,
    stage: 'season',
    team: teams[0].name,
    lastWeek: 19,
  },
  teams,
  conferences: [],
  pending_rivalries: [],
  declinedRivalries: [],
  rivalryHostSeeds: {},
  scheduleBuilt: true,
  simInitialized: true,
  settings: {
    conferencePolicy: 'current',
    postseasonPolicy: 'custom',
    playoffTeams: 12,
    playoffAutobids: 5,
    conferenceChampionsReceiveTopSeeds: false,
  },
  playoff: { seeds: [] },
  resumeSnapshot: null,
  idCounters: { game: 1, player: 23 },
});

const buildGame = (id: number, teamA: Team, teamB: Team): SimGame => ({
  id,
  teamA,
  teamB,
  homeTeam: null,
  awayTeam: null,
  neutralSite: true,
  venue: null,
  winner: null,
  baseLabel: `${teamA.name} vs ${teamB.name}`,
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 1,
  year: 2026,
  rankATOG: teamA.ranking,
  rankBTOG: teamB.ranking,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  clockRunning: false,
  timeoutsRemainingA: 3,
  timeoutsRemainingB: 3,
  scoreA: 0,
  scoreB: 0,
  watchability: null,
});

type EqualTeamTotals = {
  games: number;
  points: number;
  plays: number;
  scrimmagePlays: number;
  offensiveYards: number;
  rushingYards: number;
  passingYards: number;
  drives: number;
  threeAndOuts: number;
  driveEndings: Record<DriveEndingCategory, number>;
  runs: number;
  passes: number;
  passAttempts: number;
  completions: number;
  sacks: number;
  interceptions: number;
  fumbles: number;
  punts: number;
  fieldGoals: number;
  madeFieldGoals: number;
  touchdowns: number;
  thirdDownAttempts: number;
  thirdDownConversions: number;
  fourthDownAttempts: number;
  fourthDownConversions: number;
  redZoneTrips: number;
  redZoneScores: number;
  redZoneTouchdowns: number;
  overtimeGames: number;
  minimumFieldPosition: number;
  maximumFieldPosition: number;
  invalidFieldPositions: number;
  regulationPlays: number;
  runningAfter: number;
  stoppedAfter: number;
  firstDownStops: number;
  outOfBoundsStops: number;
  twoMinuteTimeouts: number;
  endOfQuarterEvents: number;
  halftimeEvents: number;
  endOfRegulationEvents: number;
  regulationElapsedSeconds: number;
  timingCategories: Record<TimingCategory, {
    plays: number;
    liveBallSeconds: number;
    elapsedSeconds: number;
  }>;
  tempo: Record<ClockTempo, {
    plays: number;
    elapsedSeconds: number;
    runoffPlays: number;
    runoffSeconds: number;
  }>;
  chargedTimeouts: number;
  offenseTimeouts: number;
  defenseTimeouts: number;
  firstHalfTimeouts: number;
  secondHalfTimeouts: number;
  spikes: number;
  kneels: number;
  timeoutSecondsSaved: number;
  touchdownDriveSixes: number;
  touchdownDriveSevens: number;
  touchdownDriveEights: number;
  extraPointAttempts: number;
  extraPointsMade: number;
  twoPointAttempts: number;
  twoPointsMade: number;
  skippedTries: number;
  ordinaryExtraPointDecisions: number;
  lateRegulationTwoPointDecisions: number;
  firstOvertimeTieTwoPointDecisions: number;
  mandatorySecondOvertimeTwoPointDecisions: number;
  shootoutTwoPointDecisions: number;
  overtimeGamesEndingByPeriod: Map<number, number>;
  samples: {
    combinedPoints: number[];
    margins: number[];
    offensiveYards: number[];
    scrimmagePlays: number[];
    touchdowns: number[];
    turnovers: number[];
    punts: number[];
    shutouts: number;
  };
};

type ConceptTotal = {
  calls: number;
  yards: number;
  successes: number;
  explosives: number;
  negativePlays: number;
  turnovers: number;
  fumbles: number;
  completions: number;
  sacks: number;
  interceptions: number;
  completionYards: number;
  completedPassExplosives: number;
  runs: number;
  passes: number;
};

const createTimingCategoryTotals = (): EqualTeamTotals['timingCategories'] => ({
  run: { plays: 0, liveBallSeconds: 0, elapsedSeconds: 0 },
  completedPass: { plays: 0, liveBallSeconds: 0, elapsedSeconds: 0 },
  incompletePass: { plays: 0, liveBallSeconds: 0, elapsedSeconds: 0 },
  sack: { plays: 0, liveBallSeconds: 0, elapsedSeconds: 0 },
  specialTeams: { plays: 0, liveBallSeconds: 0, elapsedSeconds: 0 },
  turnover: { plays: 0, liveBallSeconds: 0, elapsedSeconds: 0 },
});

const createEqualTeamTotals = (): EqualTeamTotals => ({
  games: 0,
  points: 0,
  plays: 0,
  scrimmagePlays: 0,
  offensiveYards: 0,
  rushingYards: 0,
  passingYards: 0,
  drives: 0,
  threeAndOuts: 0,
  driveEndings: Object.fromEntries(
    DRIVE_ENDING_CATEGORIES.map(category => [category, 0]),
  ) as Record<DriveEndingCategory, number>,
  runs: 0,
  passes: 0,
  passAttempts: 0,
  completions: 0,
  sacks: 0,
  interceptions: 0,
  fumbles: 0,
  punts: 0,
  fieldGoals: 0,
  madeFieldGoals: 0,
  touchdowns: 0,
  thirdDownAttempts: 0,
  thirdDownConversions: 0,
  fourthDownAttempts: 0,
  fourthDownConversions: 0,
  redZoneTrips: 0,
  redZoneScores: 0,
  redZoneTouchdowns: 0,
  overtimeGames: 0,
  minimumFieldPosition: Number.POSITIVE_INFINITY,
  maximumFieldPosition: Number.NEGATIVE_INFINITY,
  invalidFieldPositions: 0,
  regulationPlays: 0,
  runningAfter: 0,
  stoppedAfter: 0,
  firstDownStops: 0,
  outOfBoundsStops: 0,
  twoMinuteTimeouts: 0,
  endOfQuarterEvents: 0,
  halftimeEvents: 0,
  endOfRegulationEvents: 0,
  regulationElapsedSeconds: 0,
  timingCategories: createTimingCategoryTotals(),
  tempo: {
    normal: { plays: 0, elapsedSeconds: 0, runoffPlays: 0, runoffSeconds: 0 },
    hurry_up: { plays: 0, elapsedSeconds: 0, runoffPlays: 0, runoffSeconds: 0 },
    chew_clock: { plays: 0, elapsedSeconds: 0, runoffPlays: 0, runoffSeconds: 0 },
  },
  chargedTimeouts: 0,
  offenseTimeouts: 0,
  defenseTimeouts: 0,
  firstHalfTimeouts: 0,
  secondHalfTimeouts: 0,
  spikes: 0,
  kneels: 0,
  timeoutSecondsSaved: 0,
  touchdownDriveSixes: 0,
  touchdownDriveSevens: 0,
  touchdownDriveEights: 0,
  extraPointAttempts: 0,
  extraPointsMade: 0,
  twoPointAttempts: 0,
  twoPointsMade: 0,
  skippedTries: 0,
  ordinaryExtraPointDecisions: 0,
  lateRegulationTwoPointDecisions: 0,
  firstOvertimeTieTwoPointDecisions: 0,
  mandatorySecondOvertimeTwoPointDecisions: 0,
  shootoutTwoPointDecisions: 0,
  overtimeGamesEndingByPeriod: new Map(),
  samples: {
    combinedPoints: [],
    margins: [],
    offensiveYards: [],
    scrimmagePlays: [],
    touchdowns: [],
    turnovers: [],
    punts: [],
    shutouts: 0,
  },
});

const emptyConceptTotal = (): ConceptTotal => ({
  calls: 0,
  yards: 0,
  successes: 0,
  explosives: 0,
  negativePlays: 0,
  turnovers: 0,
  fumbles: 0,
  completions: 0,
  sacks: 0,
  interceptions: 0,
  completionYards: 0,
  completedPassExplosives: 0,
  runs: 0,
  passes: 0,
});

const createConceptTotals = () => new Map<OffensiveConcept, ConceptTotal>(
  OFFENSIVE_CONCEPTS.map(concept => [concept, emptyConceptTotal()]),
);

const createDefensiveTotals = () => new Map<DefensiveIntent, ConceptTotal>(
  DEFENSIVE_INTENTS.map(intent => [intent, emptyConceptTotal()]),
);

const createDefensiveMatchupTotals = () => new Map<
  DefensiveIntent,
  Map<OffensiveConcept, ConceptTotal>
>(DEFENSIVE_INTENTS.map(intent => [
  intent,
  new Map(OFFENSIVE_CONCEPTS.map(concept => [concept, emptyConceptTotal()])),
]));

const recordPlayMetric = (total: ConceptTotal, play: PlayRecord) => {
  total.calls += 1;
  total.yards += play.yardsGained;
  if (play.playType === 'run') total.runs += 1;
  if (play.playType === 'pass') total.passes += 1;
  const successThreshold = play.down === 1
    ? play.yardsLeft * 0.5
    : play.down === 2
      ? play.yardsLeft * 0.7
      : play.yardsLeft;
  if (play.result === 'touchdown' || play.yardsGained >= successThreshold) {
    total.successes += 1;
  }
  if (play.yardsGained >= 20) total.explosives += 1;
  if (play.yardsGained <= 0) total.negativePlays += 1;
  if (play.result === 'interception' || play.result === 'fumble') total.turnovers += 1;
  if (play.result === 'fumble') total.fumbles += 1;
  if (play.playType === 'pass'
    && (play.result === 'pass' || play.result === 'touchdown')) {
    total.completions += 1;
    total.completionYards += play.yardsGained;
    if (play.yardsGained >= 20) total.completedPassExplosives += 1;
  }
  if (play.result === 'sack') total.sacks += 1;
  if (play.result === 'interception') total.interceptions += 1;
};

const recordEqualTeamMetrics = (
  totals: EqualTeamTotals,
  conceptTotals: Map<OffensiveConcept, ConceptTotal>,
  defensiveTotals: Map<DefensiveIntent, ConceptTotal>,
  matchupTotals: Map<DefensiveIntent, Map<OffensiveConcept, ConceptTotal>>,
  game: SimGame,
  drives: ReturnType<typeof simGame>,
) => {
  const plays = drives.flatMap(drive => drive.plays);
  const ordinaryPlays = plays.filter(play => play.call.kind !== 'try');
  const scrimmagePlays = ordinaryPlays.filter(play => (
    play.playType === 'run' || play.playType === 'pass'
  ));
  const gameOffensiveYards = scrimmagePlays.reduce(
    (total, play) => total + play.yardsGained,
    0,
  );
  const gameTouchdowns = ordinaryPlays.filter(play => play.result === 'touchdown').length;
  const gameTurnovers = ordinaryPlays.filter(play => (
    play.result === 'interception' || play.result === 'fumble'
  )).length;
  const gamePunts = ordinaryPlays.filter(play => play.result === 'punt').length;
  totals.games += 1;
  totals.points += game.scoreA + game.scoreB;
  totals.plays += ordinaryPlays.length;
  totals.scrimmagePlays += scrimmagePlays.length;
  totals.offensiveYards += gameOffensiveYards;
  totals.samples.combinedPoints.push(game.scoreA + game.scoreB);
  totals.samples.margins.push(Math.abs(game.scoreA - game.scoreB));
  totals.samples.offensiveYards.push(gameOffensiveYards);
  totals.samples.scrimmagePlays.push(scrimmagePlays.length);
  totals.samples.touchdowns.push(gameTouchdowns);
  totals.samples.turnovers.push(gameTurnovers);
  totals.samples.punts.push(gamePunts);
  if (game.scoreA === 0 || game.scoreB === 0) totals.samples.shutouts += 1;
  const ordinaryDrives = drives.filter(drive => {
    const timing = drive.plays[0]?.timing;
    return !(timing?.kind === 'try'
      && timing.context === 'overtime'
      && timing.period >= 3);
  });
  totals.drives += ordinaryDrives.length;
  for (const drive of ordinaryDrives) {
    const result = drive.record.result;
    const category: DriveEndingCategory = result === 'touchdown'
      ? 'touchdown'
      : result === 'punt'
        ? 'punt'
        : result === 'made field goal' || result === 'missed field goal'
          ? 'field_goal'
          : result === 'interception' || result === 'fumble'
            ? 'turnover'
            : result === 'turnover on downs'
              ? 'turnover_on_downs'
              : result === 'end of half' || result === 'end of game'
                ? 'period_end'
                : 'other';
    totals.driveEndings[category] += 1;
    const scrimmagePlays = drive.plays.filter(play => (
      play.call.kind !== 'try'
      && (play.playType === 'run' || play.playType === 'pass')
    ));
    if (result === 'punt' && scrimmagePlays.length === 3) totals.threeAndOuts += 1;
  }
  if (game.overtime > 0) {
    totals.overtimeGames += 1;
    totals.overtimeGamesEndingByPeriod.set(
      game.overtime,
      (totals.overtimeGamesEndingByPeriod.get(game.overtime) ?? 0) + 1,
    );
  }
  for (const drive of drives) {
    const touchdown = drive.plays.find(play => play.result === 'touchdown');
    const tryPlay = drive.plays.find(play => play.call.kind === 'try');
    if (touchdown) {
      if (drive.record.points === 6) totals.touchdownDriveSixes += 1;
      if (drive.record.points === 7) totals.touchdownDriveSevens += 1;
      if (drive.record.points === 8) totals.touchdownDriveEights += 1;
      if (!tryPlay) totals.skippedTries += 1;
    }
    const redZoneTrip = drive.plays.some(play => (
      play.call.kind !== 'try'
      && (play.playType === 'run' || play.playType === 'pass')
      && play.startingFP >= 80
    ));
    if (redZoneTrip) {
      totals.redZoneTrips += 1;
      if (drive.plays.some(play => play.result === 'touchdown')) {
        totals.redZoneTouchdowns += 1;
        totals.redZoneScores += 1;
      } else if (drive.plays.some(play => play.result === 'made field goal')) {
        totals.redZoneScores += 1;
      }
    }
    if (!tryPlay || tryPlay.call.kind !== 'try') continue;
    if (tryPlay.call.attempt === 'extra_point') {
      totals.extraPointAttempts += 1;
      totals.ordinaryExtraPointDecisions += 1;
      if (tryPlay.result === 'made extra point') totals.extraPointsMade += 1;
      continue;
    }
    totals.twoPointAttempts += 1;
    if (twoPointSucceeded(tryPlay.result)) totals.twoPointsMade += 1;
    if (tryPlay.timing.kind !== 'try') continue;
    if (tryPlay.timing.context === 'regulation') {
      totals.lateRegulationTwoPointDecisions += 1;
    } else if (tryPlay.timing.period === 1) {
      totals.firstOvertimeTieTwoPointDecisions += 1;
    } else if (tryPlay.timing.period === 2) {
      totals.mandatorySecondOvertimeTwoPointDecisions += 1;
    } else {
      totals.shootoutTwoPointDecisions += 1;
    }
  }
  for (const play of plays) {
    if (play.call.kind === 'try') continue;
    if (play.playType === 'run') {
      totals.runs += 1;
      totals.rushingYards += play.yardsGained;
    }
    if (play.playType === 'pass') {
      totals.passes += 1;
      if (play.result !== 'sack') totals.passAttempts += 1;
      else totals.rushingYards += play.yardsGained;
    }
    if (play.playType === 'pass' && (play.result === 'pass' || play.result === 'touchdown')) {
      totals.completions += 1;
      totals.passingYards += play.yardsGained;
    }
    if (play.result === 'sack') totals.sacks += 1;
    if (play.result === 'interception') totals.interceptions += 1;
    if (play.result === 'fumble') totals.fumbles += 1;
    if (play.result === 'punt') totals.punts += 1;
    if (play.playType === 'field goal') {
      totals.fieldGoals += 1;
      if (play.result === 'made field goal') totals.madeFieldGoals += 1;
    }
    if (play.result === 'touchdown') totals.touchdowns += 1;
    if (play.down === 3 && (play.playType === 'run' || play.playType === 'pass')) {
      totals.thirdDownAttempts += 1;
      if (play.result !== 'interception' && play.result !== 'fumble'
        && (play.result === 'touchdown' || play.yardsGained >= play.yardsLeft)) {
        totals.thirdDownConversions += 1;
      }
    }
    if (play.down === 4 && (play.playType === 'run' || play.playType === 'pass')) {
      totals.fourthDownAttempts += 1;
      if (play.result !== 'interception' && play.result !== 'fumble'
        && (play.result === 'touchdown' || play.yardsGained >= play.yardsLeft)) {
        totals.fourthDownConversions += 1;
      }
    }
    if (play.call.kind === 'scrimmage') {
      const concept = conceptTotals.get(play.call.offense)!;
      recordPlayMetric(concept, play);
      recordPlayMetric(defensiveTotals.get(play.call.defense)!, play);
      recordPlayMetric(matchupTotals.get(play.call.defense)!.get(play.call.offense)!, play);
    }
  }
};

const summarizeConcepts = (
  totals: Map<OffensiveConcept, ConceptTotal>,
): ConceptMetrics => Object.fromEntries(
  OFFENSIVE_CONCEPTS.map(concept => {
    const total = totals.get(concept)!;
    return [concept, {
      calls: total.calls,
      yardsPerPlay: average(total.yards, total.calls),
      successRate: average(total.successes, total.calls),
      explosiveRate: average(total.explosives, total.calls),
      negativePlayRate: average(total.negativePlays, total.calls),
      turnoverRate: average(total.turnovers, total.calls),
      fumbleRate: average(total.fumbles, total.runs),
      completionRate: average(total.completions, total.passes),
      sackRate: average(total.sacks, total.passes),
      interceptionRate: average(total.interceptions, total.passes),
      yardsPerCompletion: average(total.completionYards, total.completions),
      completedPassExplosiveRate: average(
        total.completedPassExplosives,
        total.completions,
      ),
    }];
  }),
) as ConceptMetrics;

const summarizeDefensiveTotals = <Key extends string>(
  keys: readonly Key[],
  totals: Map<Key, ConceptTotal>,
) => Object.fromEntries(keys.map(key => {
  const total = totals.get(key)!;
  return [key, {
    calls: total.calls,
    yardsPerPlay: average(total.yards, total.calls),
    successRate: average(total.successes, total.calls),
    explosiveRate: average(total.explosives, total.calls),
    negativePlayRate: average(total.negativePlays, total.calls),
    turnoverRate: average(total.turnovers, total.calls),
    fumbleRate: average(total.fumbles, total.runs),
    completionRate: average(total.completions, total.passes),
    sackRate: average(total.sacks, total.passes),
    interceptionRate: average(total.interceptions, total.passes),
    yardsPerCompletion: average(total.completionYards, total.completions),
    completedPassExplosiveRate: average(
      total.completedPassExplosives,
      total.completions,
    ),
  }];
})) as Record<Key, ConceptMetric>;

const summarizeDefensiveMatchups = (
  totals: Map<DefensiveIntent, Map<OffensiveConcept, ConceptTotal>>,
): DefensiveMatchupMetrics => Object.fromEntries(DEFENSIVE_INTENTS.map(intent => [
  intent,
  summarizeDefensiveTotals(OFFENSIVE_CONCEPTS, totals.get(intent)!),
])) as DefensiveMatchupMetrics;

export const summarizeDistribution = (values: readonly number[]): DistributionSummary => ({
  mean: average(values.reduce((total, value) => total + value, 0), values.length),
  standardDeviation: populationStandardDeviation(values),
  p10: percentile(values, 0.10),
  p25: percentile(values, 0.25),
  p50: percentile(values, 0.50),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.90),
  p95: percentile(values, 0.95),
});

const summarizeEqualTeams = (totals: EqualTeamTotals): EqualTeamMetrics => ({
  combinedPointsPerGame: average(totals.points, totals.games),
  resolvedPlaysPerGame: average(totals.plays, totals.games),
  scrimmagePlaysPerGame: average(totals.scrimmagePlays, totals.games),
  offensiveYardsPerGame: average(totals.offensiveYards, totals.games),
  yardsPerPlay: average(totals.offensiveYards, totals.scrimmagePlays),
  drivesPerGame: average(totals.drives, totals.games),
  threeAndOutsPerGame: average(totals.threeAndOuts, totals.games),
  threeAndOutRate: average(totals.threeAndOuts, totals.drives),
  driveEndings: Object.fromEntries(DRIVE_ENDING_CATEGORIES.map(category => [
    category,
    {
      perGame: average(totals.driveEndings[category], totals.games),
      share: average(totals.driveEndings[category], totals.drives),
    },
  ])) as EqualTeamMetrics['driveEndings'],
  passPlayShare: average(totals.passes, totals.passes + totals.runs),
  completionRate: average(totals.completions, totals.passAttempts),
  sackRate: average(totals.sacks, totals.passes),
  interceptionRate: average(totals.interceptions, totals.passAttempts),
  fumbleRate: average(totals.fumbles, totals.runs),
  rushingYardsPerAttempt: average(
    totals.rushingYards,
    totals.runs + totals.sacks,
  ),
  passingYardsPerAttempt: average(totals.passingYards, totals.passAttempts),
  passingYardsPerCompletion: average(totals.passingYards, totals.completions),
  puntsPerGame: average(totals.punts, totals.games),
  fieldGoalAttemptsPerGame: average(totals.fieldGoals, totals.games),
  madeFieldGoalsPerGame: average(totals.madeFieldGoals, totals.games),
  fieldGoalMakeRate: average(totals.madeFieldGoals, totals.fieldGoals),
  touchdownsPerGame: average(totals.touchdowns, totals.games),
  turnoversPerGame: average(totals.interceptions + totals.fumbles, totals.games),
  fumblesLostPerGame: average(totals.fumbles, totals.games),
  thirdDownAttemptsPerGame: average(totals.thirdDownAttempts, totals.games),
  thirdDownConversionRate: average(
    totals.thirdDownConversions,
    totals.thirdDownAttempts,
  ),
  fourthDownAttemptsPerGame: average(totals.fourthDownAttempts, totals.games),
  fourthDownConversionRate: average(
    totals.fourthDownConversions,
    totals.fourthDownAttempts,
  ),
  redZoneTripsPerGame: average(totals.redZoneTrips, totals.games),
  redZoneScoringRate: average(totals.redZoneScores, totals.redZoneTrips),
  redZoneTouchdownRate: average(totals.redZoneTouchdowns, totals.redZoneTrips),
  overtimeGameRate: average(totals.overtimeGames, totals.games),
  fieldPosition: {
    minimum: totals.minimumFieldPosition,
    maximum: totals.maximumFieldPosition,
    invalidCount: totals.invalidFieldPositions,
  },
});

const summarizeEqualTeamDistributions = (
  totals: EqualTeamTotals,
): EqualTeamDistributions => {
  const samples = totals.samples;
  const share = (values: readonly number[], predicate: (value: number) => boolean) =>
    average(values.filter(predicate).length, values.length);
  return {
    combinedPoints: summarizeDistribution(samples.combinedPoints),
    margin: summarizeDistribution(samples.margins),
    offensiveYards: summarizeDistribution(samples.offensiveYards),
    scrimmagePlays: summarizeDistribution(samples.scrimmagePlays),
    touchdowns: summarizeDistribution(samples.touchdowns),
    turnovers: summarizeDistribution(samples.turnovers),
    punts: summarizeDistribution(samples.punts),
    resultShares: {
      marginAtMostThree: share(samples.margins, value => value <= 3),
      marginAtMostEight: share(samples.margins, value => value <= 8),
      marginAtLeastTwenty: share(samples.margins, value => value >= 20),
      marginAtLeastThirty: share(samples.margins, value => value >= 30),
      shutout: average(samples.shutouts, totals.games),
      combinedAtLeastSeventy: share(samples.combinedPoints, value => value >= 70),
      combinedAtMostThirty: share(samples.combinedPoints, value => value <= 30),
    },
  };
};

const buildCalibrationSummary = (
  metrics: EqualTeamMetrics,
  distributions: EqualTeamDistributions,
) => {
  const productionValues: Record<string, number> = {
    scrimmagePlaysPerGame: metrics.scrimmagePlaysPerGame,
    offensiveYardsPerGame: metrics.offensiveYardsPerGame,
    yardsPerPlay: metrics.yardsPerPlay,
    touchdownsPerGame: metrics.touchdownsPerGame,
    puntsPerGame: metrics.puntsPerGame,
    madeFieldGoalsPerGame: metrics.madeFieldGoalsPerGame,
    fieldGoalMakeRate: metrics.fieldGoalMakeRate,
    turnoversPerGame: metrics.turnoversPerGame,
    fumblesLostPerGame: metrics.fumblesLostPerGame,
    passPlayShare: metrics.passPlayShare,
    completionRate: metrics.completionRate,
    sackRate: metrics.sackRate,
    interceptionRate: metrics.interceptionRate,
    rushingYardsPerAttempt: metrics.rushingYardsPerAttempt,
    passingYardsPerAttempt: metrics.passingYardsPerAttempt,
    passingYardsPerCompletion: metrics.passingYardsPerCompletion,
    thirdDownAttemptsPerGame: metrics.thirdDownAttemptsPerGame,
    thirdDownConversionRate: metrics.thirdDownConversionRate,
    fourthDownAttemptsPerGame: metrics.fourthDownAttemptsPerGame,
    fourthDownConversionRate: metrics.fourthDownConversionRate,
    redZoneScoringRate: metrics.redZoneScoringRate,
    redZoneTouchdownRate: metrics.redZoneTouchdownRate,
  };
  const scoreValues: Record<string, number> = {
    combinedPointsMean: distributions.combinedPoints.mean,
    combinedPointsStandardDeviation: distributions.combinedPoints.standardDeviation,
    combinedPointsP10: distributions.combinedPoints.p10,
    combinedPointsP25: distributions.combinedPoints.p25,
    combinedPointsP50: distributions.combinedPoints.p50,
    combinedPointsP75: distributions.combinedPoints.p75,
    combinedPointsP90: distributions.combinedPoints.p90,
    combinedPointsP95: distributions.combinedPoints.p95,
    marginMean: distributions.margin.mean,
    marginStandardDeviation: distributions.margin.standardDeviation,
    marginP25: distributions.margin.p25,
    marginP50: distributions.margin.p50,
    marginP75: distributions.margin.p75,
    marginP90: distributions.margin.p90,
    marginP95: distributions.margin.p95,
    marginAtMostThreeShare: distributions.resultShares.marginAtMostThree,
    marginAtMostEightShare: distributions.resultShares.marginAtMostEight,
    marginAtLeastTwentyShare: distributions.resultShares.marginAtLeastTwenty,
    marginAtLeastThirtyShare: distributions.resultShares.marginAtLeastThirty,
    shutoutShare: distributions.resultShares.shutout,
    combinedAtLeastSeventyShare: distributions.resultShares.combinedAtLeastSeventy,
    combinedAtMostThirtyShare: distributions.resultShares.combinedAtMostThirty,
  };
  const buildGroup = (
    values: Record<string, number>,
    targets: Record<string, CalibrationTarget>,
  ) => Object.fromEntries(Object.keys(targets).sort().map(key => [
    key,
    measureCalibration(values[key], targets[key]),
  ]));
  const { targets: _targets, ...benchmark } = SIM_CALIBRATION_BENCHMARK;
  const calibration: CalibrationSummary = {
    benchmark,
    production: buildGroup(productionValues, SIM_CALIBRATION_BENCHMARK.targets.production),
    scoreDistribution: buildGroup(
      scoreValues,
      SIM_CALIBRATION_BENCHMARK.targets.scoreDistribution,
    ),
  };
  const gaps = (['production', 'scoreDistribution'] as const).flatMap(group => (
    Object.entries(calibration[group])
      .filter(([, measurement]) => measurement.status !== 'aligned')
      .map(([key, measurement]) => `${group}.${key}:${measurement.status}`)
  )).sort();
  return { calibration, gaps };
};

const summarizeTries = (totals: EqualTeamTotals): TryMetrics => ({
  touchdownDrives: {
    sixPoints: totals.touchdownDriveSixes,
    sevenPoints: totals.touchdownDriveSevens,
    eightPoints: totals.touchdownDriveEights,
  },
  extraPoints: {
    attempts: totals.extraPointAttempts,
    made: totals.extraPointsMade,
    makeRate: average(totals.extraPointsMade, totals.extraPointAttempts),
  },
  twoPoints: {
    attempts: totals.twoPointAttempts,
    made: totals.twoPointsMade,
    conversionRate: average(totals.twoPointsMade, totals.twoPointAttempts),
  },
  skippedTries: totals.skippedTries,
  automaticDecisionReasons: {
    ordinaryExtraPoint: totals.ordinaryExtraPointDecisions,
    lateRegulationTwoPoint: totals.lateRegulationTwoPointDecisions,
    firstOvertimeTieTwoPoint: totals.firstOvertimeTieTwoPointDecisions,
    mandatorySecondOvertimeTwoPoint: totals.mandatorySecondOvertimeTwoPointDecisions,
    shootoutTwoPoint: totals.shootoutTwoPointDecisions,
  },
  overtimeGamesEndingByPeriod: Object.fromEntries(
    [...totals.overtimeGamesEndingByPeriod.entries()]
      .sort(([left], [right]) => left - right)
      .map(([period, games]) => [String(period), games]),
  ),
});

const summarizeClock = (totals: EqualTeamTotals): ClockMetrics => ({
  byCategory: Object.fromEntries(
    (Object.keys(totals.timingCategories) as TimingCategory[]).map(category => {
      const timing = totals.timingCategories[category];
      return [category, {
        plays: timing.plays,
        averageLiveBallSeconds: average(timing.liveBallSeconds, timing.plays),
        averageElapsedSeconds: average(timing.elapsedSeconds, timing.plays),
      }];
    }),
  ) as ClockMetrics['byCategory'],
  runningAfterShare: average(totals.runningAfter, totals.regulationPlays),
  stoppedAfterShare: average(totals.stoppedAfter, totals.regulationPlays),
  firstDownStopsPerGame: average(totals.firstDownStops, totals.games),
  outOfBoundsStopsPerGame: average(totals.outOfBoundsStops, totals.games),
  twoMinuteTimeoutsPerGame: average(totals.twoMinuteTimeouts, totals.games),
  periodEventsPerGame: {
    endOfQuarter: average(totals.endOfQuarterEvents, totals.games),
    halftime: average(totals.halftimeEvents, totals.games),
    endOfRegulation: average(totals.endOfRegulationEvents, totals.games),
  },
  regulationTimeOfPossessionSecondsPerGame: average(
    totals.regulationElapsedSeconds,
    totals.games,
  ),
  management: {
    tempo: Object.fromEntries(
      (['normal', 'hurry_up', 'chew_clock'] as ClockTempo[]).map(tempo => {
        const total = totals.tempo[tempo];
        return [tempo, {
          plays: total.plays,
          averageElapsedSeconds: average(total.elapsedSeconds, total.plays),
          averageRunoffSeconds: average(total.runoffSeconds, total.runoffPlays),
        }];
      }),
    ) as ClockMetrics['management']['tempo'],
    chargedTimeoutsPerGame: average(totals.chargedTimeouts, totals.games),
    offenseTimeoutsPerGame: average(totals.offenseTimeouts, totals.games),
    defenseTimeoutsPerGame: average(totals.defenseTimeouts, totals.games),
    firstHalfTimeoutsPerGame: average(totals.firstHalfTimeouts, totals.games),
    secondHalfTimeoutsPerGame: average(totals.secondHalfTimeouts, totals.games),
    spikesPerGame: average(totals.spikes, totals.games),
    kneelsPerGame: average(totals.kneels, totals.games),
    timeSavedPerGame: average(totals.timeoutSecondsSaved, totals.games),
  },
});

const evaluateSimulationForDifferences = (
  options: SimulationEvaluationOptions,
  ratingDifferences: readonly number[],
  enforceBaseline: boolean,
): SimulationEvaluationSummary => {
  const random = createSeededRandom(options.seed);
  const artifacts: unknown[] = [];
  const violations: string[] = [];
  const ratingResults: RatingResult[] = [];
  const equalTotals = createEqualTeamTotals();
  const conceptTotals = createConceptTotals();
  const defensiveTotals = createDefensiveTotals();
  const defensiveMatchupTotals = createDefensiveMatchupTotals();
  const players = buildPlayers();
  const starters = buildStartersCacheFromPlayers(players);
  let gameId = 1;

  withSeededMathRandom(random, () => {
    for (const ratingDifference of ratingDifferences) {
      let winsA = 0;
      let margin = 0;
      let yardsA = 0;
      let yardsB = 0;
      const margins: number[] = [];
      const scoresA: number[] = [];
      const scoresB: number[] = [];
      for (let gameIndex = 0; gameIndex < options.gamesPerDiff; gameIndex += 1) {
        const teamA = buildTeam(1, BASE_RATING + ratingDifference);
        const teamB = buildTeam(2, BASE_RATING);
        const league = buildLeague([teamA, teamB]);
        const game = buildGame(gameId++, teamA, teamB);
        const drives = simGame(league, game, starters);
        const plays = drives.flatMap(drive => drive.plays);
        const logs = createGameLogsFromPlays(game, plays, starters);
        auditSimulatedGame(
          game,
          drives,
          logs,
          starters,
          ratingDifference === 0 ? equalTotals : null,
          violations,
        );
        if (ratingDifference === 0) {
          recordEqualTeamMetrics(
            equalTotals,
            conceptTotals,
            defensiveTotals,
            defensiveMatchupTotals,
            game,
            drives,
          );
        }
        if (game.scoreA > game.scoreB) winsA += 1;
        const gameMargin = game.scoreA - game.scoreB;
        margin += gameMargin;
        margins.push(gameMargin);
        scoresA.push(game.scoreA);
        scoresB.push(game.scoreB);
        for (const play of plays) {
          if (play.call.kind === 'try') continue;
          if (play.offenseId === teamA.id) yardsA += play.yardsGained;
          if (play.offenseId === teamB.id) yardsB += play.yardsGained;
        }
        artifacts.push({
          ratingDifference,
          gameIndex,
          result: {
            scoreA: game.scoreA,
            scoreB: game.scoreB,
            winnerId: game.winner?.id ?? null,
            resultA: game.resultA,
            resultB: game.resultB,
            overtime: game.overtime,
            quarter: game.quarter,
            clockSecondsLeft: game.clockSecondsLeft,
          },
          drives,
          logs,
        });
      }
      ratingResults.push({
        ratingDifference,
        games: options.gamesPerDiff,
        teamAWinRate: average(winsA, options.gamesPerDiff),
        averageMargin: average(margin, options.gamesPerDiff),
        marginStandardDeviation: populationStandardDeviation(margins),
        medianMargin: percentile(margins, 0.50),
        p90Margin: percentile(margins, 0.90),
        oneScoreRate: average(
          margins.filter(value => Math.abs(value) <= 8).length,
          margins.length,
        ),
        favoriteBlowoutRate: average(
          margins.filter(value => value >= 20).length,
          margins.length,
        ),
        averageYardsA: average(yardsA, options.gamesPerDiff),
        averageYardsB: average(yardsB, options.gamesPerDiff),
        teamAScoring: summarizeDistribution(scoresA),
        teamBScoring: summarizeDistribution(scoresB),
      });
    }
  });

  const equalTeamMetrics = summarizeEqualTeams(equalTotals);
  const equalTeamDistributions = summarizeEqualTeamDistributions(equalTotals);
  const conceptMetrics = summarizeConcepts(conceptTotals);
  const defensiveMetrics = summarizeDefensiveTotals(DEFENSIVE_INTENTS, defensiveTotals);
  const defensiveMatchupMetrics = summarizeDefensiveMatchups(defensiveMatchupTotals);
  const clockMetrics = summarizeClock(equalTotals);
  const tryMetrics = summarizeTries(equalTotals);
  const { calibration, gaps: calibrationGaps } = buildCalibrationSummary(
    equalTeamMetrics,
    equalTeamDistributions,
  );
  const baselineApplied = enforceBaseline
    && options.seed === 20260809
    && options.gamesPerDiff === 1000;
  if (baselineApplied) {
    violations.push(...evaluateDefaultSimulationGates({
      ratingResults,
      equalTeamMetrics,
      conceptMetrics,
      defensiveMetrics,
      defensiveMatchupMetrics,
      clockMetrics,
      tryMetrics,
    }));
  }
  const checksum = checksumPartitions(artifacts);
  if (
    baselineApplied &&
    SIM_EVALUATION_BASELINE_CHECKSUM &&
    checksum !== SIM_EVALUATION_BASELINE_CHECKSUM
  ) {
    violations.push(
      `Simulation checksum ${checksum} does not match ${SIM_EVALUATION_BASELINE_CHECKSUM}.`,
    );
  }

  return {
    configuration: {
      ...options,
      ratingDifferences,
      baseRating: BASE_RATING,
    },
    checksum,
    baselineChecksum: SIM_EVALUATION_BASELINE_CHECKSUM,
    baselineApplied,
    ratingResults,
    equalTeamMetrics,
    equalTeamDistributions,
    conceptMetrics,
    defensiveMetrics,
    defensiveMatchupMetrics,
    clockMetrics,
    tryMetrics,
    calibration,
    calibrationGaps,
    violations,
  };
};

export const evaluateSimulation = (
  options: SimulationEvaluationOptions,
): SimulationEvaluationSummary => evaluateSimulationForDifferences(
  options,
  SIM_EVALUATION_DIFFS,
  true,
);

export const measureEqualTeamSimulation = (
  options: SimulationEvaluationOptions,
): SimulationEvaluationSummary => evaluateSimulationForDifferences(
  options,
  [0],
  false,
);
