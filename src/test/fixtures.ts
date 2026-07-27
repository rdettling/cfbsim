import type { PlayerRecord } from '../types/db';
import type { LeagueStage, Team } from '../types/domain';
import { DEFAULT_SETTINGS, type LeagueState } from '../types/league';

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
    rivalryHostSeeds: {},
    scheduleBuilt: true,
    simInitialized: true,
    settings: { ...DEFAULT_SETTINGS },
    playoff: { seeds: [] },
    idCounters: {
      game: 2,
      drive: 2,
      play: 2,
      gameLog: 2,
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
  active: true,
  ...overrides,
});
