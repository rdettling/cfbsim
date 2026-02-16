/// <reference types="node" />
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simGame } from '../src/domain/sim/engine';
import type { LeagueState } from '../src/types/league';
import type { Team, Info } from '../src/types/domain';
import type { StartersCache, SimGame } from '../src/types/sim';
import type { PlayerRecord } from '../src/types/db';

const MAX_DIFF = 100;
const TEST_SIMULATIONS = 1000;
const TAX_FACTOR = 0.05;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..', '..');
const OUTPUT_PATH = join(ROOT, 'frontend2', 'public', 'data', 'betting_odds.json');

const createTeam = (id: number, rating: number): Team => ({
  id,
  name: `Test Team ${rating}`,
  abbreviation: 'TST',
  confGames: 0,
  confLimit: 8,
  nonConfGames: 0,
  nonConfLimit: 4,
  prestige: 50,
  prestige_change: 0,
  ceiling: 99,
  floor: 1,
  mascot: 'Testers',
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
  last_game: null,
  next_game: null,
});

const createInfo = (): Info => ({
  currentWeek: 1,
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
  scheduleBuilt: true,
  simInitialized: true,
  settings: {
    playoff_teams: 12,
    playoff_autobids: 5,
    playoff_conf_champ_top_4: true,
    auto_realignment: true,
    auto_update_postseason_format: true,
  },
  playoff: { seeds: [] },
  idCounters: {
    game: 1,
    drive: 1,
    play: 1,
    gameLog: 1,
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
  development_trait: 3,
  starter: true,
  active: true,
});

const buildStarters = (team: Team, rating: number, baseId: number): StartersCache => {
  const positions = ['qb', 'rb', 'wr', 'wr', 'te', 'k', 'p'];
  const players = positions.map((pos, index) => createPlayer(baseId + index, team.id, pos, rating));
  const byTeamPos = new Map<string, PlayerRecord[]>();
  positions.forEach((pos, index) => {
    const key = `${team.id}:${pos}`;
    const current = byTeamPos.get(key) ?? [];
    current.push(players[index]);
    byTeamPos.set(key, current);
  });
  return { byTeamPos };
};

const buildGame = (teamA: Team, teamB: Team): SimGame => ({
  id: 1,
  teamA,
  teamB,
  homeTeam: null,
  awayTeam: null,
  neutralSite: true,
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
  scoreA: 0,
  scoreB: 0,
  headline: null,
  watchability: 0,
});

const runDiff = (diff: number) => {
  let scoreA = 0;
  let scoreB = 0;
  let winA = 0;
  let winB = 0;

  for (let i = 0; i < TEST_SIMULATIONS; i += 1) {
    const teamA = createTeam(1, diff);
    const teamB = createTeam(2, 0);
    const league = createLeague([teamA, teamB]);
    const starters = buildStarters(teamA, diff, i * 1000);
    const startersB = buildStarters(teamB, 0, i * 1000 + 100);
    startersB.byTeamPos.forEach((players, key) => starters.byTeamPos.set(key, players));

    const game = buildGame(teamA, teamB);
    simGame(league, game, starters);

    scoreA += game.scoreA;
    scoreB += game.scoreB;
    if (game.winner?.id === teamA.id) winA += 1;
    if (game.winner?.id === teamB.id) winB += 1;
  }

  const avgScoreA = Math.round((scoreA / TEST_SIMULATIONS) * 10) / 10;
  const avgScoreB = Math.round((scoreB / TEST_SIMULATIONS) * 10) / 10;
  const winProbA = Math.round((winA / TEST_SIMULATIONS) * 1000) / 1000;
  const winProbB = Math.round((winB / TEST_SIMULATIONS) * 1000) / 1000;

  const spread = Math.round((avgScoreA - avgScoreB) * 2) / 2;
  const spreadA =
    spread > 0 ? `-${Math.abs(spread)}` : spread < 0 ? `+${Math.abs(spread)}` : 'Even';
  const spreadB =
    spread > 0 ? `+${Math.abs(spread)}` : spread < 0 ? `-${Math.abs(spread)}` : 'Even';

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

const main = async () => {
  const odds: Record<number, ReturnType<typeof runDiff>> = {};
  for (let diff = 0; diff <= MAX_DIFF; diff += 1) {
    odds[diff] = runDiff(diff);
  }

  const payload = {
    generated_at: new Date().toISOString(),
    test_simulations: TEST_SIMULATIONS,
    max_diff: MAX_DIFF,
    odds,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote betting odds to ${OUTPUT_PATH}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
