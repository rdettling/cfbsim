import { simGame } from '../src/domain/sim/engine';
import {
  BETTING_ODDS_MAX_DIFF,
  BETTING_ODDS_SEED,
  BETTING_ODDS_SIMULATIONS,
  validateBettingOddsData,
} from '../src/domain/baseDataValidation';
import { createSeededRandom, withSeededMathRandom } from '../src/domain/utils/random';
import type { BettingOddsData } from '../src/types/baseData';
import {
  DEFAULT_NEXT_SEASON_CONFIGURATION,
  type LeagueState,
} from '../src/types/league';
import type { Team, Info } from '../src/types/domain';
import type { StartersCache, SimGame } from '../src/types/sim';
import type { PlayerRecord } from '../src/types/db';

const TAX_FACTOR = 0.05;

const createTeam = (id: number, rating: number): Team => ({
  id,
  name: `Test Team ${rating}`,
  abbreviation: 'TST',
  confGames: 0,
  confLimit: 8,
  nonConfGames: 0,
  nonConfLimit: 4,
  prestige: 50,
  ceiling: 99,
  floor: 1,
  mascot: 'Testers',
  city: 'Test City',
  state: 'Test State',
  stadium: 'Test Stadium',
  ranking: 1,
  offense: rating,
  defense: rating,
  colorPrimary: '#000000',
  colorSecondary: '#FFFFFF',
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
  record: '0-0 (0-0)',
  movement: 0,
  poll_score: 0,
  strength_of_record: 0,
  strength_of_record_avg: 0,
  last_rank: null,
  last_game: null,
  next_game: null,
});

const createInfo = (): Info => ({
  currentWeek: 1,
  lastRankingsWeek: 0,
  currentYear: 2024,
  startYear: 2024,
  stage: 'season',
  team: 'Test Team',
  lastWeek: 14,
});

const createLeague = (teams: Team[]): LeagueState => ({
  info: createInfo(),
  teams,
  conferences: [],
  pending_rivalries: [],
  declinedRivalries: [],
  rivalryHostSeeds: {},
  scheduleBuilt: true,
  simInitialized: true,
  settings: { ...DEFAULT_NEXT_SEASON_CONFIGURATION },
  playoff: { seeds: [] },
  resumeSnapshot: null,
  idCounters: {
    game: 1,
    player: 1,
  },
});

const createPlayer = (
  id: number,
  teamId: number,
  pos: string,
  rating: number
): PlayerRecord => ({
  id,
  teamId,
  first: 'Test',
  last: pos.toUpperCase(),
  year: 'sr',
  pos,
  rating,
  rating_fr: rating,
  rating_so: rating,
  rating_jr: rating,
  rating_sr: rating,
  stars: 5,
  starter: true,
});

const buildStarters = (
  team: Team,
  rating: number,
  baseId: number,
): StartersCache => {
  const positions = [
    'qb', 'rb', 'wr', 'wr', 'te', 'k', 'p',
    'dl', 'dl', 'lb', 'lb', 'cb', 'cb', 's',
  ];
  const players = positions.map((pos, index) =>
    createPlayer(baseId + index, team.id, pos, rating));
  const byTeamPos = new Map<string, PlayerRecord[]>();
  positions.forEach((pos, index) => {
    const key = `${team.id}:${pos}`;
    const current = byTeamPos.get(key) ?? [];
    current.push(players[index]);
    byTeamPos.set(key, current);
  });
  return { byTeamPos, byId: new Map(players.map(player => [player.id, player])) };
};

const buildGame = (teamA: Team, teamB: Team): SimGame => ({
  id: 1,
  teamA,
  teamB,
  homeTeam: null,
  awayTeam: null,
  neutralSite: true,
  venue: null,
  winner: null,
  baseLabel: 'Test Game',
  name: 'Test Game',
  spreadA: '0',
  spreadB: '0',
  moneylineA: '0',
  moneylineB: '0',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 1,
  year: 2024,
  rankATOG: 1,
  rankBTOG: 1,
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
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: 0,
});

const runDiff = (diff: number) => {
  let scoreA = 0;
  let scoreB = 0;
  let winA = 0;
  let winB = 0;

  for (let i = 0; i < BETTING_ODDS_SIMULATIONS; i += 1) {
    const teamA = createTeam(1, diff);
    const teamB = createTeam(2, 0);
    const league = createLeague([teamA, teamB]);
    const starters = buildStarters(teamA, diff, i * 1000);
    const startersB = buildStarters(teamB, 0, i * 1000 + 100);
    startersB.byTeamPos.forEach((players, key) => starters.byTeamPos.set(key, players));
    startersB.byId.forEach((player, id) => starters.byId.set(id, player));

    const game = buildGame(teamA, teamB);
    simGame(league, game, starters);

    scoreA += game.scoreA;
    scoreB += game.scoreB;
    if (game.winner?.id === teamA.id) winA += 1;
    if (game.winner?.id === teamB.id) winB += 1;
  }

  const avgScoreA = Math.round((scoreA / BETTING_ODDS_SIMULATIONS) * 10) / 10;
  const avgScoreB = Math.round((scoreB / BETTING_ODDS_SIMULATIONS) * 10) / 10;
  const winProbA = Math.round((winA / BETTING_ODDS_SIMULATIONS) * 1000) / 1000;
  const winProbB = Math.round((winB / BETTING_ODDS_SIMULATIONS) * 1000) / 1000;

  const spread = Math.round((avgScoreA - avgScoreB) * 2) / 2;
  const spreadA =
    spread > 0
      ? `-${Math.abs(spread)}`
      : spread < 0 ? `+${Math.abs(spread)}` : 'Even';
  const spreadB =
    spread > 0
      ? `+${Math.abs(spread)}`
      : spread < 0 ? `-${Math.abs(spread)}` : 'Even';

  let impliedProbA = Math.round((winProbA + TAX_FACTOR / 2) * 100) / 100;
  let impliedProbB = Math.round((winProbB + TAX_FACTOR / 2) * 100) / 100;
  impliedProbA = Math.min(0.99, Math.max(0.01, impliedProbA));
  impliedProbB = Math.min(0.99, Math.max(0.01, impliedProbB));

  const moneylineA =
    impliedProbA > 0.5
      ? `-${Math.round((impliedProbA / (1 - impliedProbA)) * 100)}`
      : `+${Math.round(((1 / impliedProbA) - 1) * 100)}`;
  const moneylineB =
    impliedProbB > 0.5
      ? `-${Math.round((impliedProbB / (1 - impliedProbB)) * 100)}`
      : `+${Math.round(((1 / impliedProbB) - 1) * 100)}`;

  return {
    favSpread: spreadA,
    udSpread: spreadB,
    favWinProb: winProbA,
    udWinProb: winProbB,
    favMoneyline: moneylineA,
    udMoneyline: moneylineB,
  };
};

let cachedBettingOdds: BettingOddsData | null = null;

export const buildBettingOddsData = (): BettingOddsData => {
  if (cachedBettingOdds) return cachedBettingOdds;
  cachedBettingOdds = withSeededMathRandom(
    createSeededRandom(BETTING_ODDS_SEED),
    () => {
      const odds: Record<number, ReturnType<typeof runDiff>> = {};
      for (let diff = 0; diff <= BETTING_ODDS_MAX_DIFF; diff += 1) {
        odds[diff] = runDiff(diff);
      }

      return validateBettingOddsData({
        seed: BETTING_ODDS_SEED,
        test_simulations: BETTING_ODDS_SIMULATIONS,
        max_diff: BETTING_ODDS_MAX_DIFF,
        odds,
      });
    },
  );
  return cachedBettingOdds;
};
