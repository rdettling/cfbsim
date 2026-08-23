import type { PlayerRecord } from '../../../src/types/db';
import type { Team } from '../../../src/types/domain';
import type { LeagueState } from '../../../src/types/league';
import type { SimGame } from '../../../src/types/sim';
import { checksumPartitions } from '../shared/checksum';
import { createSeededRandom, withSeededMathRandom } from '../../../src/domain/utils/random';
import {
  simGame,
} from '../../../src/domain/sim/engine';
import {
  buildStartersCacheFromPlayers,
  createGameLogsFromPlays,
} from '../../../src/domain/sim/statistics';
import type { SimulationEvaluationOptions } from './cli';
import { DEFENSIVE_INTENTS } from '../../../src/domain/sim/defensiveIntents';
import {
  percentile,
  populationStandardDeviation,
} from './calibrationBenchmark';
import type {
  RatingMatchupProduction,
  RatingResult,
} from './calibrationMetrics';
import {
  auditSimulatedGame,
} from './evaluationAudit';
import { evaluateDefaultSimulationGates } from './evaluationGates';
import {
  buildCalibrationSummary,
  createConceptTotals,
  createDefensiveMatchupTotals,
  createDefensiveTotals,
  createEqualTeamTotals,
  recordGameMetrics,
  summarizeClock,
  summarizeConcepts,
  summarizeDefensiveMatchups,
  summarizeDefensiveTotals,
  summarizeDistribution,
  summarizeEqualTeamDistributions,
  summarizeEqualTeams,
  summarizeTries,
  type SimulationEvaluationSummary,
} from './evaluationMetrics';

const BASE_RATING = 75;
export const SIM_EVALUATION_DIFFS = [0, 7, 14, 21] as const;
export const SIM_EVALUATION_BASELINE_CHECKSUM = 'c26ef84f';

const average = (value: number, count: number) => count ? value / count : 0;

type RatingProductionTotals = {
  yards: number;
  scrimmagePlays: number;
  points: number;
  drives: number;
  passAttempts: number;
  completions: number;
  sacks: number;
  turnovers: number;
  explosives: number;
};

const createRatingProductionTotals = (): RatingProductionTotals => ({
  yards: 0,
  scrimmagePlays: 0,
  points: 0,
  drives: 0,
  passAttempts: 0,
  completions: 0,
  sacks: 0,
  turnovers: 0,
  explosives: 0,
});

const recordRatingProduction = (
  totals: RatingProductionTotals,
  teamId: number,
  drives: ReturnType<typeof simGame>,
) => {
  const teamDrives = drives.filter(drive => drive.record.offenseId === teamId);
  const plays = teamDrives.flatMap(drive => drive.plays).filter(play => (
    play.call.kind !== 'try'
    && (play.playType === 'run' || play.playType === 'pass')
  ));
  totals.drives += teamDrives.length;
  totals.points += teamDrives.reduce((sum, drive) => sum + drive.record.points, 0);
  totals.scrimmagePlays += plays.length;
  for (const play of plays) {
    totals.yards += play.yardsGained;
    if (play.yardsGained >= 20) totals.explosives += 1;
    if (play.result === 'interception' || play.result === 'fumble') {
      totals.turnovers += 1;
    }
    if (play.playType !== 'pass') continue;
    if (play.result === 'sack') totals.sacks += 1;
    else totals.passAttempts += 1;
    if (play.result === 'pass' || play.result === 'touchdown') {
      totals.completions += 1;
    }
  }
};

const summarizeRatingProduction = (
  totals: RatingProductionTotals,
): RatingMatchupProduction => ({
  yardsPerPlay: average(totals.yards, totals.scrimmagePlays),
  pointsPerDrive: average(totals.points, totals.drives),
  completionRate: average(totals.completions, totals.passAttempts),
  sackRate: average(totals.sacks, totals.passAttempts + totals.sacks),
  turnoverRate: average(totals.turnovers, totals.scrimmagePlays),
  explosivePlayRate: average(totals.explosives, totals.scrimmagePlays),
});

const ratingPair = (ratingDifference: number): [number, number] => {
  if (ratingDifference >= 0) {
    const teamA = Math.min(99, BASE_RATING + ratingDifference);
    return [teamA, teamA - ratingDifference];
  }
  const teamA = Math.max(25, BASE_RATING + ratingDifference);
  return [teamA, teamA - ratingDifference];
};

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
  confName: 'Independent',
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
  wins_over_expectation: 0,
  wins_over_expectation_per_game: 0,
  last_rank: null,
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
  watchability: 0,
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
      const [teamARating, teamBRating] = ratingPair(ratingDifference);
      let winsA = 0;
      let margin = 0;
      let yardsA = 0;
      let yardsB = 0;
      const margins: number[] = [];
      const scoresA: number[] = [];
      const scoresB: number[] = [];
      const productionA = createRatingProductionTotals();
      const productionB = createRatingProductionTotals();
      for (let gameIndex = 0; gameIndex < options.gamesPerDiff; gameIndex += 1) {
        const teamA = buildTeam(1, teamARating);
        const teamB = buildTeam(2, teamBRating);
        const league = buildLeague([teamA, teamB]);
        const game = buildGame(gameId++, teamA, teamB);
        const drives = simGame(league, game, starters);
        const plays = drives.flatMap(drive => drive.plays);
        const logs = createGameLogsFromPlays(game, plays, starters);
        recordRatingProduction(productionA, teamA.id, drives);
        recordRatingProduction(productionB, teamB.id, drives);
        auditSimulatedGame(
          game,
          drives,
          logs,
          starters,
          ratingDifference === 0 ? equalTotals : null,
          violations,
        );
        if (ratingDifference === 0) {
          recordGameMetrics(
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
        teamARating,
        teamBRating,
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
        teamAProduction: summarizeRatingProduction(productionA),
        teamBProduction: summarizeRatingProduction(productionB),
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
  options.ratingDifferences ?? SIM_EVALUATION_DIFFS,
  options.ratingDifferences === undefined,
);

export const measureEqualTeamSimulation = (
  options: SimulationEvaluationOptions,
): SimulationEvaluationSummary => evaluateSimulationForDifferences(
  options,
  [0],
  false,
);
