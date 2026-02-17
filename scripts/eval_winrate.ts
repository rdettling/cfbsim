import { kickoffStartFieldPosition, simGame } from '../src/domain/sim/engine';
import type { LeagueState } from '../src/types/league';
import type { Team } from '../src/types/domain';
import type { SimGame, StartersCache } from '../src/types/sim';
import type { PlayerRecord } from '../src/types/db';

const GAMES_PER_DIFF = Number(process.argv.find(arg => arg.startsWith('--games='))?.split('=')[1] ?? 300);
const BASE_RATING = Number(process.argv.find(arg => arg.startsWith('--base='))?.split('=')[1] ?? 75);
const DIFFS = (process.argv.find(arg => arg.startsWith('--diffs='))?.split('=')[1] ?? '0,7,14,21')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(value => !Number.isNaN(value));

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
  let teamBWins = 0;
  let scoreMargin = 0;
  let totalYardsA = 0;
  let totalYardsB = 0;

  for (let i = 0; i < GAMES_PER_DIFF; i += 1) {
    const teamA = createTeam(1, BASE_RATING + diff);
    const teamB = createTeam(2, BASE_RATING);
    const league = buildLeague();
    const starters = buildStarters([teamA.id, teamB.id]);
    const game = buildGame(teamA, teamB);

    const drives = simGame(league, game, starters);
    const plays = drives.flatMap(drive => drive.plays);

    plays.forEach(play => {
      if (play.offenseId === teamA.id) totalYardsA += play.yardsGained;
      if (play.offenseId === teamB.id) totalYardsB += play.yardsGained;
    });

    if (game.scoreA > game.scoreB) teamAWins += 1;
    else teamBWins += 1;
    scoreMargin += (game.scoreA - game.scoreB);
  }

  const winPct = teamAWins / (teamAWins + teamBWins);
  return {
    diff,
    winPct,
    avgMargin: scoreMargin / (teamAWins + teamBWins),
    avgYardsA: totalYardsA / (teamAWins + teamBWins),
    avgYardsB: totalYardsB / (teamAWins + teamBWins),
  };
};

console.log('Kickoff spot example:', kickoffStartFieldPosition());
console.log(`Games per diff: ${GAMES_PER_DIFF}`);
console.log('---');

DIFFS.forEach(diff => {
  const result = runDiff(diff);
  console.log(`diff ${result.diff}: win%=${(result.winPct * 100).toFixed(1)} avgMargin=${result.avgMargin.toFixed(1)} avgYdsA=${result.avgYardsA.toFixed(1)} avgYdsB=${result.avgYardsB.toFixed(1)}`);
});
