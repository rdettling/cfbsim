import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { simGame } from '../src/domain/sim/engine';
import { applySimTuning } from '../src/domain/sim/config';
import type { LeagueState } from '../src/types/league';
import type { Team } from '../src/types/domain';
import type { SimGame, StartersCache } from '../src/types/sim';
import type { PlayerRecord } from '../src/types/db';

const TUNING_PATH = resolve('src/domain/sim/tuning.json');

const TARGETS: Record<number, number> = {
  0: 0.5,
  7: 0.625,
  14: 0.775,
  21: 0.875,
};

const DIFFS = Object.keys(TARGETS).map(Number);
const GAMES_PER_DIFF = 400;
const PASSES = 50;
const WRITE = true;
const BASE_RATING = 75;

const loadTuning = () => JSON.parse(readFileSync(TUNING_PATH, 'utf-8'));

const createTeam = (id: number, rating: number): Team => ({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit: 0,
  nonConfGames: 0,
  nonConfLimit: 0,
  prestige: 0,
  ceiling: 0,
  floor: 0,
  mascot: 'Mascot',
  ranking: 0,
  offense: rating,
  defense: rating,
  colorPrimary: '#000000',
  colorSecondary: '#ffffff',
  conference: 'Ind',
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

const createPlayer = (id: number, teamId: number, pos: string): PlayerRecord => ({
  id,
  teamId,
  first: 'Player',
  last: `${id}`,
  year: 'sr',
  pos,
  rating: 75,
  rating_fr: 75,
  rating_so: 75,
  rating_jr: 75,
  rating_sr: 75,
  stars: 3,
  development_trait: 50,
  starter: true,
  active: true,
});

const buildStarters = (teamIds: number[]): StartersCache => {
  const byTeamPos = new Map<string, PlayerRecord[]>();
  const positions = ['qb', 'rb', 'wr', 'te', 'k', 'p'];
  let id = 1;
  teamIds.forEach(teamId => {
    positions.forEach(pos => {
      byTeamPos.set(`${teamId}:${pos}`, [createPlayer(id++, teamId, pos)]);
    });
  });
  return { byTeamPos };
};

const buildLeague = (): LeagueState => ({
  info: { currentWeek: 1, currentYear: 2024, stage: 'season', team: 'Team 1', lastWeek: 1 },
  teams: [],
  conferences: [],
  pending_rivalries: [],
  idCounters: { game: 1, drive: 1, play: 1, gameLog: 1, player: 1 },
});

const buildGame = (teamA: Team, teamB: Team): SimGame => ({
  id: 1,
  teamA,
  teamB,
  homeTeam: null,
  awayTeam: null,
  neutralSite: true,
  winner: null,
  baseLabel: `${teamA.name} vs ${teamB.name}`,
  name: null,
  spreadA: '',
  spreadB: '',
  moneylineA: '',
  moneylineB: '',
  winProbA: 0,
  winProbB: 0,
  weekPlayed: 1,
  year: 2024,
  rankATOG: 0,
  rankBTOG: 0,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  clockRunning: true,
  scoreA: 0,
  scoreB: 0,
  headline: null,
  headline_subtitle: null,
  headline_tags: null,
  headline_tone: null,
  watchability: null,
});

const runDiff = (diff: number) => {
  let teamAWins = 0;
  for (let i = 0; i < GAMES_PER_DIFF; i += 1) {
    const teamA = createTeam(1, BASE_RATING + diff);
    const teamB = createTeam(2, BASE_RATING);
    const league = buildLeague();
    const starters = buildStarters([teamA.id, teamB.id]);
    const game = buildGame(teamA, teamB);

    simGame(league, game, starters);
    if (game.scoreA > game.scoreB) teamAWins += 1;
  }

  return teamAWins / GAMES_PER_DIFF;
};

const evaluate = () => {
  const results: Record<number, number> = {};
  let totalError = 0;
  DIFFS.forEach(diff => {
    const winPct = runDiff(diff);
    results[diff] = winPct;
    const target = TARGETS[diff];
    const diffErr = winPct - target;
    totalError += diffErr * diffErr;
  });
  return { totalError, results };
};

let best = loadTuning();
applySimTuning(best);
let bestEval = evaluate();

const scaleCandidates = [0.6, 0.8, 1.0, 1.25, 1.5, 1.8];

for (let pass = 0; pass < PASSES; pass += 1) {
  const current = best;

  const tune = (label: string, updater: (candidate: any, scale: number) => void) => {
    let localBest = current;
    let localEval = bestEval;
    scaleCandidates.forEach(scale => {
      const candidate = structuredClone(current);
      updater(candidate, scale);
      applySimTuning(candidate);
      const evalResult = evaluate();
      if (evalResult.totalError < localEval.totalError) {
        localBest = candidate;
        localEval = evalResult;
      }
    });
    console.log(`pass ${pass + 1} ${label}: bestError=${localEval.totalError.toFixed(4)}`);
    return { tuning: localBest, eval: localEval };
  };

  const step1 = tune('ratingDiffDivisor', (candidate, scale) => {
    candidate.outcomes.ratingDiffDivisor = Math.max(10, current.outcomes.ratingDiffDivisor * scale);
  });
  best = step1.tuning;
  bestEval = step1.eval;

  if ((pass + 1) % 5 === 0) {
    console.log(`iter ${pass + 1}/${PASSES} bestError=${bestEval.totalError.toFixed(4)}`);
  }
}

console.log('\nBest win rates:', bestEval.results);
console.log('Total error:', bestEval.totalError.toFixed(4));

if (WRITE) {
  applySimTuning(best);
  writeFileSync(TUNING_PATH, JSON.stringify(best, null, 2));
  console.log(`\nWrote tuning to ${TUNING_PATH}`);
}
