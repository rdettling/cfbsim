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
import type { RatingResult } from './calibrationMetrics';
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
  recordEqualTeamMetrics,
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
export const SIM_EVALUATION_BASELINE_CHECKSUM = '1b914e9a';

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
  prestige_change: 0,
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
  strength_of_record: 0,
  strength_of_record_avg: 0,
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
