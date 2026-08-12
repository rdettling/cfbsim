import type {
  PlayCall,
  PlayParticipants,
  PlayTiming,
  PlayerRecord,
  PlayerSeasonStats,
} from '../types/db';
import type { LeagueStage, Team } from '../types/domain';
import type { SeasonTeamSnapshot } from '../types/memory';
import type { TeamAggregateTotals } from '../types/stats';
import {
  DEFAULT_NEXT_SEASON_CONFIGURATION,
  type LeagueState,
} from '../types/league';
import bettingOddsData from '../../public/data/betting_odds.json';
import statesData from '../../public/data/states.json';
import teamsData from '../../public/data/teams.json';

export const TEST_BETTING_ODDS_DATA = bettingOddsData;
export const TEST_STATES_DATA = statesData;
export const TEST_TEAMS_DATA = teamsData;

export const buildTestTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 1,
  name: 'Test State',
  abbreviation: 'TST',
  confGames: 0,
  confLimit: 8,
  nonConfGames: 0,
  nonConfLimit: 4,
  prestige: 4,
  prestige_change: 0,
  ceiling: 7,
  floor: 1,
  mascot: 'Testers',
  city: 'Test City',
  state: 'TS',
  stadium: 'Test Stadium',
  ranking: 1,
  offense: 80,
  defense: 80,
  colorPrimary: '#123456',
  colorSecondary: '#ffffff',
  conference: 'Test Conference',
  confName: 'Test Conference',
  confWins: 8,
  confLosses: 0,
  nonConfWins: 4,
  nonConfLosses: 0,
  rating: 80,
  totalWins: 12,
  totalLosses: 0,
  gamesPlayed: 12,
  record: '12-0 (8-0)',
  movement: 0,
  poll_score: 0,
  strength_of_record: 0,
  last_game: null,
  next_game: null,
  ...overrides,
});

export const buildTestLeague = (
  stage: LeagueStage,
  overrides: Partial<LeagueState> = {},
): LeagueState => {
  const team = buildTestTeam();
  return {
    info: {
      currentWeek: 18,
      lastRankingsWeek: 17,
      currentYear: 2025,
      startYear: 2025,
      stage,
      team: team.name,
      lastWeek: 18,
    },
    teams: [team],
    conferences: [
      {
        id: 1,
        confName: 'Test Conference',
        confFullName: 'Test Conference',
        confGames: 8,
        info: '',
        championship: null,
        teams: [team],
      },
    ],
    pending_rivalries: [],
    declinedRivalries: [],
    rivalryHostSeeds: {},
    scheduleBuilt: true,
    simInitialized: true,
    settings: { ...DEFAULT_NEXT_SEASON_CONFIGURATION },
    playoff: { seeds: [] },
    resumeSnapshot: null,
    idCounters: {
      game: 2,
      player: 2,
    },
    ...overrides,
  };
};

export const buildTestPlayer = (
  overrides: Partial<PlayerRecord> = {},
): PlayerRecord => ({
  id: 1,
  teamId: 1,
  first: 'Pat',
  last: 'Player',
  year: 'jr',
  pos: 'qb',
  rating: 80,
  rating_fr: 70,
  rating_so: 75,
  rating_jr: 80,
  rating_sr: 85,
  stars: 3,
  development_trait: 3,
  starter: true,
  ...overrides,
});

export const buildTestPlayParticipants = (
  overrides: Partial<PlayParticipants> = {},
): PlayParticipants => ({
  passerId: null,
  rusherId: null,
  targetId: null,
  tacklerId: null,
  sackerId: null,
  interceptorId: null,
  forcedFumbleById: null,
  fumbleRecoveryById: null,
  kickerId: null,
  punterId: null,
  ...overrides,
});

export const buildTestPlayCall = (
  overrides: Partial<Extract<PlayCall, { kind: 'scrimmage' }>> = {},
): PlayCall => ({
  kind: 'scrimmage',
  offense: 'inside_run',
  defense: 'base',
  ...overrides,
});

export const buildTestPlayTiming = (
  overrides: Partial<Extract<PlayTiming, { kind: 'regulation' }>> = {},
): PlayTiming => ({
  kind: 'regulation',
  start: { quarter: 1, secondsLeft: 900, running: false },
  end: { quarter: 1, secondsLeft: 895, running: true },
  elapsedSeconds: 5,
  outOfBounds: false,
  tempo: 'normal',
  eventAfter: null,
  chargedTimeoutAfter: null,
  ...overrides,
});

export const buildTestTeamAggregateTotals = (
  overrides: Partial<TeamAggregateTotals> = {},
): TeamAggregateTotals => ({
  games: 12,
  points: 0,
  pass_completions: 0,
  pass_attempts: 0,
  pass_yards: 0,
  pass_touchdowns: 0,
  rush_attempts: 0,
  rush_yards: 0,
  rush_touchdowns: 0,
  plays: 0,
  first_downs_pass: 0,
  first_downs_rush: 0,
  fumbles: 0,
  interceptions: 0,
  ...overrides,
});

export const buildTestSeasonTeamSnapshot = (
  overrides: Partial<SeasonTeamSnapshot> = {},
): SeasonTeamSnapshot => ({
  teamId: 1,
  conference: 'Test Conference',
  rating: 80,
  prestige: 4,
  ranking: 1,
  record: '12-0 (8-0)',
  offense: buildTestTeamAggregateTotals(),
  defense: buildTestTeamAggregateTotals(),
  ...overrides,
});

export const buildTestPlayerSeason = (
  overrides: Partial<PlayerSeasonStats> = {},
): PlayerSeasonStats => ({
  year: 2024,
  playerId: 1,
  teamId: 1,
  position: 'qb',
  classYear: 'sr',
  rating: 80,
  starter: true,
  games: 12,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
  ...overrides,
});
