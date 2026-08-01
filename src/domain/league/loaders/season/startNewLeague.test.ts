import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../db/db';
import type { GameRecord } from '../../../../types/db';
import type {
  LeagueState,
  StartNewLeagueInput,
} from '../../../../types/league';
import { buildTestLeague, buildTestPlayer } from '../../../../test/fixtures';
import { initializeSeason } from '../../season';
import { loadHomeData } from '../season';
import { loadPlayer } from '../team';
import { loadDashboard } from './loadDashboard';
import { loadNonCon } from './loadNonCon';
import { listAvailableTeams } from './listAvailableTeams';
import { loadTeamSchedule } from './loadTeamSchedule';
import { loadWeekSchedule } from './loadWeekSchedule';
import { loadGame } from './loadGame';
import { startNewLeague } from './startNewLeague';
import { scheduleNonConGame } from './scheduleNonConGame';
import {
  dismissPendingRivalry,
  removePreseasonGame,
} from './removePreseasonScheduleItem';
import { validateNewLeagueConferencePlan } from '../../../conferencePlan';
import { generateRandomSeed } from '../../../utils/randomSeed';

vi.mock('../../../utils/randomSeed', () => ({
  generateRandomSeed: vi.fn(),
}));

const yearData = (teams: 2 | 4 | 12 = 12) => ({
  playoff: {
    teams,
    conf_champ_autobids: teams === 12 ? 5 : 0,
    conf_champ_top_4: teams === 12,
  },
  conferences: {
    'Test Conference': {
      games: 0,
      teams: { 'Test State': 4 },
    },
  },
  independents: {},
});

const baseResponses = () =>
  new Map<string, unknown>([
    ['/data/years/index.json', { years: ['2025', '2024'] }],
    ['/data/years/2025.json', yearData(12)],
    ['/data/years/2024.json', yearData(4)],
    [
      '/data/history.json',
      {
        generated_at: '2026-01-01T00:00:00.000Z',
        years: [2025, 2024],
        conf_index: { 'Test Conference': 0 },
        teams: {},
      },
    ],
    [
      '/data/teams.json',
      {
        teams: {
          'Test State': {
            mascot: 'Testers',
            abbreviation: 'TST',
            ceiling: 7,
            floor: 1,
            colorPrimary: '#123456',
            colorSecondary: '#ffffff',
            city: 'Test City',
            state: 'TS',
            stadium: 'Test Stadium',
          },
        },
      },
    ],
    ['/data/conferences.json', { 'Test Conference': 'Test Conference' }],
    [
      '/data/names.json',
      {
        black: {
          first: [{ name: 'Pat', weight: 1 }],
          last: [{ name: 'Player', weight: 1 }],
        },
        white: {
          first: [{ name: 'Sam', weight: 1 }],
          last: [{ name: 'Tester', weight: 1 }],
        },
      },
    ],
    ['/data/states.json', { TS: 1 }],
    ['/data/rivalries.json', { rivalries: [] }],
    ['/data/betting_odds.json', { odds: {} }],
  ]);

let responses = baseResponses();

const resetDatabase = async () => {
  const db = await getDb();
  const stores = [
    'baseData',
    'league',
    'recruiting',
    'players',
    'games',
    'gameDetails',
    'playerSeasons',
  'historicalPlayers',
  'playerOrigins',
    'seasonMemories',
  ] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const snapshotSave = async () => {
  const db = await getDb();
  return {
    league: await db.getAll('league'),
    recruiting: await db.getAll('recruiting'),
    players: await db.getAll('players'),
    games: await db.getAll('games'),
    drives: await db.getAll('gameDetails'),
    plays: await db.getAll('playerSeasons'),
    gameLogs: await db.getAll('historicalPlayers'),
    seasonMemories: await db.getAll('seasonMemories'),
  };
};

const buildOldGame = (): GameRecord => ({
  id: 99,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: 'Old game',
  name: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 1,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  scoreA: 28,
  scoreB: 14,
  headline: null,
  watchability: 80,
});

const seedExistingLeague = async () => {
  const db = await getDb();
  await db.put('league', {
    key: 'current',
    value: buildTestLeague('season'),
  });
  await db.put('players', buildTestPlayer({ id: 99 }));
  await db.put('games', buildOldGame());
  await db.put('gameDetails', {
    gameId: 99,
    year: 2024,
    drives: [],
    playerStats: [],
  });
  await db.put('playerSeasons', {
    year: 2024,
    playerId: 99,
    teamId: 1,
    position: 'qb',
    classYear: 'jr',
    rating: 80,
    games: 1,
    pass_yards: 0,
    pass_attempts: 0,
    pass_completions: 0,
    pass_touchdowns: 0,
    pass_interceptions: 0,
    rush_yards: 5,
    rush_attempts: 1,
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
  });
  await db.put('historicalPlayers', {
    id: 100,
    first: 'Old',
    last: 'Player',
    pos: 'qb',
    stars: 3,
    development_trait: 2,
  });
  await db.put('seasonMemories', {
    year: 2025,
    playoffTeams: 12,
    events: [],
    awards: [],
  });
};

const buildInput = (
  teams: 2 | 4 | 12 = 12,
): StartNewLeagueInput => ({
  teamName: 'Test State',
  year: '2025',
  conferenceSetup: { mode: 'historical' },
  playoff: {
    teams,
    autobids: teams === 12 ? 5 : undefined,
    conferenceChampionsReceiveTopSeeds: teams === 12,
  },
});

const configureRivalryLeague = () => {
  const east = Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => [`East ${index + 1}`, 4]),
  );
  const west = Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => [`West ${index + 1}`, 4]),
  );
  const names = [...Object.keys(east), ...Object.keys(west)];
  responses.set('/data/years/2025.json', {
    ...yearData(),
    conferences: {
      East: { games: 10, teams: east },
      West: { games: 10, teams: west },
    },
  });
  responses.set('/data/teams.json', {
    teams: Object.fromEntries(names.map((name, index) => [
      name,
      {
        mascot: `Mascot ${index + 1}`,
        abbreviation: `T${index + 1}`,
        ceiling: 7,
        floor: 1,
        colorPrimary: '#123456',
        colorSecondary: '#ffffff',
        city: 'Test City',
        state: 'TS',
        stadium: 'Test Stadium',
      },
    ])),
  });
  responses.set('/data/conferences.json', { East: 'East', West: 'West' });
  responses.set('/data/rivalries.json', {
    rivalries: [
      {
        teams: ['East 1', 'West 1'],
        week: 7,
        name: 'Primary Trophy',
        site: { type: 'neutral', venue: 'Test Bowl' },
      },
      { teams: ['East 1', 'West 2'], week: 7, name: 'Rescue Trophy' },
    ],
  });
};

const rivalryInput = (): StartNewLeagueInput => ({
  teamName: 'East 1',
  year: '2025',
  conferenceSetup: { mode: 'historical' },
  playoff: {
    teams: 12,
    autobids: 2,
    conferenceChampionsReceiveTopSeeds: false,
  },
});

beforeEach(async () => {
  responses = baseResponses();
  vi.mocked(generateRandomSeed).mockReset().mockReturnValue(12345);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const value = responses.get(url);
      return new Response(
        value === undefined ? 'Not found' : JSON.stringify(value),
        {
          status: value === undefined ? 404 : 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }),
  );
  await resetDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadHomeData', () => {
  it('preserves supported-year order and returns lean sorted preview records', async () => {
    const data = await loadHomeData('2024');

    expect(data.years).toEqual(['2025', '2024']);
    expect(data.selected_year).toBe('2024');
    expect(data.preview).toMatchObject({
      conferences: [
        { name: 'Test Conference', fullName: 'Test Conference' },
      ],
      teams: [
        {
          name: 'Test State',
          mascot: 'Testers',
          prestige: 4,
          conferenceName: 'Test Conference',
        },
      ],
      playoff: { teams: 4 },
    });
  });

  it('rejects a year outside the bundled index', async () => {
    await expect(loadHomeData('1999')).rejects.toThrow(
      'The 1999 season is not supported.',
    );
  });

  it('rejects malformed preview data through the shared year validator', async () => {
    responses.set('/data/years/2024.json', {
      ...yearData(4),
      Independent: {},
    });

    await expect(loadHomeData('2024')).rejects.toThrow(
      'Year 2024: year data has invalid fields',
    );
  });
});

describe('startNewLeague', () => {
  it('requests a fresh schedule seed for each season initialization', async () => {
    vi.mocked(generateRandomSeed)
      .mockReturnValueOnce(101)
      .mockReturnValueOnce(202);

    await startNewLeague(buildInput());
    await initializeSeason(2025);
    await startNewLeague(buildInput());
    await initializeSeason(2025);

    expect(generateRandomSeed).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed creation data through the shared year validator', async () => {
    responses.set('/data/years/2025.json', {
      ...yearData(),
      playoff: { teams: 6 },
    });

    await expect(startNewLeague(buildInput())).rejects.toThrow(
      'Year 2025: playoff has invalid fields',
    );
  });

  it('keeps season loaders read-only and initializes the season by command', async () => {
    await startNewLeague(buildInput());
    expect(fetch).not.toHaveBeenCalledWith('/data/history.json');
    expect(
      vi.mocked(fetch).mock.calls.some(([input]) =>
        String(input).includes('/season-results/'),
      ),
    ).toBe(false);
    const before = await snapshotSave();

    await loadDashboard();
    await loadTeamSchedule();
    expect(await snapshotSave()).toEqual(before);

    await expect(initializeSeason(2025)).resolves.toMatchObject({
      stage: 'season',
      year: 2025,
      route: '/dashboard',
    });
    const db = await getDb();
    expect((await db.get('league', 'current'))?.value).toMatchObject({
      info: { stage: 'season' },
      scheduleBuilt: true,
      simInitialized: true,
    });
  });

  it('creates a custom alignment, preserves it, and builds complete schedules', async () => {
    const customTeams = Object.fromEntries(
      Array.from({ length: 13 }, (_, index) => [`Team ${index + 1}`, 4]),
    );
    responses.set('/data/years/2025.json', {
      ...yearData(),
      conferences: {
        'Test Conference': {
          games: 12,
          teams: customTeams,
        },
      },
    });
    responses.set('/data/teams.json', {
      teams: Object.fromEntries(
        Object.keys(customTeams).map((name, index) => [
          name,
          {
            mascot: `Mascot ${index + 1}`,
            abbreviation: `T${index + 1}`,
            ceiling: 7,
            floor: 1,
            colorPrimary: '#123456',
            colorSecondary: '#ffffff',
            city: 'Test City',
            state: 'TS',
            stadium: 'Test Stadium',
          },
        ]),
      ),
    });

    const conferencePlan = {
      assignments: Object.fromEntries(
        Object.keys(customTeams).map(name => [name, 'Test Conference']),
      ),
      conferenceGames: {
        'Test Conference': { mode: 'automatic' as const },
      },
    };
    await expect(
      validateNewLeagueConferencePlan('2025', conferencePlan),
    ).resolves.toEqual({ issues: [], warnings: [] });

    await startNewLeague({
      teamName: 'Team 1',
      year: '2025',
      conferenceSetup: {
        mode: 'custom',
        plan: conferencePlan,
      },
      playoff: {
        teams: 12,
        autobids: 1,
        conferenceChampionsReceiveTopSeeds: false,
      },
    });

    const db = await getDb();
    const created = (await db.get('league', 'current'))?.value as LeagueState;
    expect(created.settings.conferencePolicy).toBe('current');
    expect(created.conferences).toHaveLength(1);
    await initializeSeason(2025);
    const games = await db.getAllFromIndex('games', 'year', 2025);
    const counts = new Map<number, number>();
    games.forEach(game => {
      counts.set(game.teamAId, (counts.get(game.teamAId) ?? 0) + 1);
      counts.set(game.teamBId, (counts.get(game.teamBId) ?? 0) + 1);
    });
    expect([...counts.values()]).toEqual(Array(13).fill(12));
  });

  it('locks an accepted fixed rivalry and allows manual rescue of an omitted one', async () => {
    configureRivalryLeague();

    const conferencePlan = {
      assignments: Object.fromEntries([
        ...Array.from({ length: 13 }, (_, index) => [`East ${index + 1}`, 'East']),
        ...Array.from({ length: 13 }, (_, index) => [`West ${index + 1}`, 'West']),
      ]),
      conferenceGames: {
        East: { mode: 'automatic' as const },
        West: { mode: 'automatic' as const },
      },
    };
    await expect(
      validateNewLeagueConferencePlan('2025', conferencePlan),
    ).resolves.toMatchObject({
      issues: [],
      warnings: [{ teamA: 'East 1', teamB: 'West 2' }],
    });

    const created = await startNewLeague(rivalryInput());
    expect(created.schedule[6]).toMatchObject({
      opponent: { name: 'West 1' },
      label: 'Primary Trophy',
      location: 'Neutral',
      venue: 'Test Bowl',
    });
    expect(created.rivalryWarnings).toMatchObject([
      { teamA: 'East 1', teamB: 'West 2', name: 'Rescue Trophy' },
    ]);

    const db = await getDb();
    const initialGames = await db.getAllFromIndex('games', 'year', 2025);
    expect(initialGames).toHaveLength(1);
    expect(initialGames[0]).toMatchObject({
      neutralSite: true,
      homeTeamId: null,
      awayTeamId: null,
      venue: 'Test Bowl',
    });
    expect((await loadTeamSchedule('East 1', 2025)).schedule[6]).toMatchObject({
      location: 'Neutral',
      venue: 'Test Bowl',
    });
    expect((await loadWeekSchedule(7)).games[0]).toMatchObject({
      neutralSite: true,
      venue: 'Test Bowl',
    });
    expect((await loadGame(initialGames[0].id)).game).toMatchObject({
      neutralSite: true,
      venue: 'Test Bowl',
    });
    await expect(scheduleNonConGame('West 2', 7)).rejects.toThrow(
      'Week 7 already has a scheduled game.',
    );
    expect(await db.getAllFromIndex('games', 'year', 2025)).toHaveLength(1);

    await scheduleNonConGame('West 2', 8);
    const games = await db.getAllFromIndex('games', 'year', 2025);
    expect(games).toHaveLength(2);
    expect(games.find(game => game.teamBId !== games[0].teamBId)).toMatchObject({
      weekPlayed: 8,
      name: 'Rescue Trophy',
    });
    expect((await loadNonCon()).rivalryWarnings).toEqual([]);
  });

  it('rejects an infeasible manual game without changing persisted state', async () => {
    configureRivalryLeague();
    await startNewLeague(rivalryInput());
    const db = await getDb();
    const fixedGame = (await db.getAllFromIndex('games', 'year', 2025))[0];
    await db.put('games', {
      ...fixedGame,
      id: 999,
      weekPlayed: 6,
    });
    const gamesBefore = await db.getAllFromIndex('games', 'year', 2025);
    const leagueBefore = (await db.get('league', 'current'))?.value;

    await expect(scheduleNonConGame('West 2', 8)).rejects.toThrow(
      'would leave the remaining schedule impossible to complete',
    );

    expect(await db.getAllFromIndex('games', 'year', 2025)).toEqual(gamesBefore);
    expect((await db.get('league', 'current'))?.value).toEqual(leagueBefore);
  });

  it('rejects stale manual selections without changing persisted state', async () => {
    configureRivalryLeague();
    await startNewLeague(rivalryInput());
    const db = await getDb();
    const expectUnchangedRejection = async (
      opponent: string,
      week: number,
      message: string,
    ) => {
      const gamesBefore = await db.getAllFromIndex('games', 'year', 2025);
      const leagueBefore = (await db.get('league', 'current'))?.value;
      await expect(scheduleNonConGame(opponent, week)).rejects.toThrow(message);
      expect(await db.getAllFromIndex('games', 'year', 2025)).toEqual(
        gamesBefore,
      );
      expect((await db.get('league', 'current'))?.value).toEqual(leagueBefore);
    };

    await expectUnchangedRejection(
      'Unknown State',
      8,
      'Unknown State is not available for scheduling.',
    );
    await expectUnchangedRejection(
      'West 2',
      15,
      'Week 15 is not available for preseason scheduling.',
    );
    await expectUnchangedRejection(
      'West 2',
      7,
      'Week 7 already has a scheduled game.',
    );
    await expectUnchangedRejection(
      'West 1',
      8,
      'West 1 is already on the schedule.',
    );
    await expectUnchangedRejection(
      'East 2',
      8,
      'East 2 is not an eligible non-conference opponent.',
    );

    const fixedGame = (await db.getAllFromIndex('games', 'year', 2025))[0];
    const league = (await db.get('league', 'current'))?.value as LeagueState;
    const east2 = league.teams.find(team => team.name === 'East 2')!;
    const west2 = league.teams.find(team => team.name === 'West 2')!;
    await db.put('games', {
      ...fixedGame,
      id: 999,
      teamAId: east2.id,
      teamBId: west2.id,
      homeTeamId: east2.id,
      awayTeamId: west2.id,
      weekPlayed: 8,
    });
    await expectUnchangedRejection(
      'West 2',
      8,
      'West 2 already has a game in Week 8.',
    );
    await db.delete('games', 999);

    west2.nonConfGames = west2.nonConfLimit;
    await db.put('league', { key: 'current', value: league });
    await expectUnchangedRejection(
      'West 2',
      8,
      'West 2 has no non-conference scheduling capacity remaining.',
    );

    west2.nonConfGames = 0;
    const userTeam = league.teams.find(team => team.name === 'East 1')!;
    userTeam.nonConfGames = userTeam.nonConfLimit;
    await db.put('league', { key: 'current', value: league });
    await expectUnchangedRejection(
      'West 2',
      8,
      'No non-conference scheduling capacity remains.',
    );
  });

  it('keeps other seasons out of preseason loader projections', async () => {
    configureRivalryLeague();
    const created = await startNewLeague(rivalryInput());
    expect(created).toEqual(await loadNonCon());

    const db = await getDb();
    const fixedGame = (await db.getAllFromIndex('games', 'year', 2025))[0];
    const league = (await db.get('league', 'current'))?.value as LeagueState;
    const west2 = league.teams.find(team => team.name === 'West 2')!;
    await db.put('games', {
      ...fixedGame,
      id: 999,
      teamBId: west2.id,
      awayTeamId: west2.id,
      weekPlayed: 8,
      year: 2024,
    });
    league.info.currentWeek = 8;
    await db.put('league', { key: 'current', value: league });

    expect((await loadNonCon()).schedule[7].opponent).toBeNull();
    expect(await listAvailableTeams(8)).toContain('West 2');
    expect((await loadDashboard()).curr_game?.opponent).toBeNull();
  });

  it('removes fixed and pending rivalries for the current season', async () => {
    configureRivalryLeague();
    responses.set('/data/rivalries.json', {
      rivalries: [
        {
          teams: ['East 1', 'West 1'],
          week: 7,
          name: 'Primary Trophy',
          site: { type: 'neutral', venue: 'Test Bowl' },
        },
        { teams: ['East 1', 'West 2'], name: 'Flexible Trophy' },
      ],
    });

    const created = await startNewLeague(rivalryInput());
    expect(created.pending_rivalries).toMatchObject([
      { teamA: 'East 1', teamB: 'West 2', name: 'Flexible Trophy' },
    ]);
    const db = await getDb();
    const fixedGame = (await db.getAllFromIndex('games', 'year', 2025))[0];

    await dismissPendingRivalry('East 1', 'West 2');
    await removePreseasonGame(fixedGame.id);

    const preseason = await loadNonCon();
    expect(preseason.schedule[6].opponent).toBeNull();
    expect(preseason.pending_rivalries).toEqual([]);
    expect(await db.getAllFromIndex('games', 'year', 2025)).toEqual([]);
    const league = (await db.get('league', 'current'))?.value as LeagueState;
    expect(league.declinedRivalries).toEqual([
      'East 1::West 2',
      'East 1::West 1',
    ]);
    expect(league.teams.find(team => team.name === 'East 1')?.nonConfGames).toBe(0);
    expect(league.teams.find(team => team.name === 'West 1')?.nonConfGames).toBe(0);

    await initializeSeason(2025);
    expect((await db.get('league', 'current'))?.value).toMatchObject({
      info: { stage: 'season' },
      declinedRivalries: ['East 1::West 2', 'East 1::West 1'],
    });
  });

  it('removes manual games and restores rivalry behavior when rescheduled', async () => {
    configureRivalryLeague();
    responses.set('/data/rivalries.json', {
      rivalries: [{
        teams: ['East 1', 'West 1'],
        name: 'Flexible Trophy',
        site: { type: 'neutral', venue: 'Test Bowl' },
      }],
    });
    await startNewLeague(rivalryInput());
    const db = await getDb();

    await scheduleNonConGame('West 1', 3);
    let game = (await db.getAllFromIndex('games', 'year', 2025))[0];
    expect(game).toMatchObject({
      weekPlayed: 3,
      name: 'Flexible Trophy',
      neutralSite: true,
      venue: 'Test Bowl',
    });
    await removePreseasonGame(game.id);
    expect((await db.get('league', 'current'))?.value).toMatchObject({
      declinedRivalries: ['East 1::West 1'],
    });

    const returned = await scheduleNonConGame('West 1', 4);
    game = (await db.getAllFromIndex('games', 'year', 2025))[0];
    expect(game).toMatchObject({
      weekPlayed: 4,
      name: 'Flexible Trophy',
      neutralSite: true,
      venue: 'Test Bowl',
    });
    expect(returned.schedule[3]).toMatchObject({
      id: `${game.id}`,
      opponent: { name: 'West 1' },
      label: 'Flexible Trophy',
      location: 'Neutral',
      venue: 'Test Bowl',
    });
    expect(returned).toEqual(await loadNonCon());
    expect((await db.get('league', 'current'))?.value).toMatchObject({
      declinedRivalries: [],
    });

    await removePreseasonGame(game.id);
    responses.set('/data/rivalries.json', { rivalries: [] });
    await scheduleNonConGame('West 2', 5);
    game = (await db.getAllFromIndex('games', 'year', 2025))[0];
    await removePreseasonGame(game.id);
    expect((await db.get('league', 'current'))?.value).toMatchObject({
      declinedRivalries: ['East 1::West 1'],
    });
  });

  it('rejects schedule removals outside an editable preseason', async () => {
    configureRivalryLeague();
    await startNewLeague(rivalryInput());
    const db = await getDb();
    const game = (await db.getAllFromIndex('games', 'year', 2025))[0];
    const league = (await db.get('league', 'current'))?.value as LeagueState;

    await expect(removePreseasonGame(999_999)).rejects.toThrow(
      'The scheduled game is not available for removal.',
    );
    await db.put('games', { ...game, year: 2024 });
    await expect(removePreseasonGame(game.id)).rejects.toThrow(
      'The scheduled game is not available for removal.',
    );
    await db.put('games', game);
    const east2 = league.teams.find(team => team.name === 'East 2')!;
    const west2 = league.teams.find(team => team.name === 'West 2')!;
    const unrelated = {
      ...game,
      id: 999,
      teamAId: east2.id,
      teamBId: west2.id,
      homeTeamId: east2.id,
      awayTeamId: west2.id,
    };
    await db.put('games', unrelated);
    await expect(removePreseasonGame(unrelated.id)).rejects.toThrow(
      'The scheduled game is not available for removal.',
    );
    await expect(
      dismissPendingRivalry('East 1', 'West 9'),
    ).rejects.toThrow('The pending rivalry is not available for removal.');

    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await db.put('league', { key: 'current', value: league });

    const gamesBefore = await db.getAllFromIndex('games', 'year', 2025);
    const leagueBefore = (await db.get('league', 'current'))?.value;
    await expect(scheduleNonConGame('West 2', 8)).rejects.toThrow(
      'Preseason scheduling is no longer editable.',
    );
    expect(await db.getAllFromIndex('games', 'year', 2025)).toEqual(
      gamesBefore,
    );
    expect((await db.get('league', 'current'))?.value).toEqual(leagueBefore);
    await expect(removePreseasonGame(game.id)).rejects.toThrow(
      'Preseason scheduling is no longer editable.',
    );
    await expect(
      dismissPendingRivalry('East 1', 'West 1'),
    ).rejects.toThrow('Preseason scheduling is no longer editable.');
    expect(await db.get('games', game.id)).toEqual(game);
  });

  it.each([
    { teams: 2 as const, lastWeek: 16 },
    { teams: 4 as const, lastWeek: 17 },
    { teams: 12 as const, lastWeek: 19 },
  ])(
    'creates a reloadable $teams-team preseason league',
    async ({ teams, lastWeek }) => {
      await seedExistingLeague();
      const result = await startNewLeague(buildInput(teams));
      const db = await getDb();
      const leagueRecord = await db.get('league', 'current');
      const league = leagueRecord?.value as LeagueState;

      expect(league.info).toMatchObject({
        stage: 'preseason',
        team: 'Test State',
        currentYear: 2025,
        lastWeek,
      });
      expect(league.settings).toMatchObject({
        conferencePolicy: 'historical',
        postseasonPolicy: 'historical',
        playoffTeams: teams,
        playoffAutobids: teams === 12 ? 5 : 0,
        conferenceChampionsReceiveTopSeeds: teams === 12,
      });
      expect(league.idCounters.player).toBeGreaterThan(1);
      expect(await db.getAll('players')).not.toEqual([
        buildTestPlayer({ id: 99 }),
      ]);
      expect(await db.getAll('games')).toEqual([]);
      expect(await db.getAll('gameDetails')).toEqual([]);
      expect(await db.getAll('playerSeasons')).toEqual([]);
      expect(await db.getAll('historicalPlayers')).toEqual([]);
      const persistedPlayers = await db.getAll('players');
      const origins = await db.getAll('playerOrigins');
      expect(origins).toHaveLength(persistedPlayers.length);
      expect(origins.every(origin =>
        origin.kind === 'initial_roster' &&
        origin.acquisitionYear === 2025 &&
        origin.originalTeamId > 0
      )).toBe(true);
      const playerPage = await loadPlayer(String(persistedPlayers[0].id));
      expect(playerPage.origin).toMatchObject({
        playerId: persistedPlayers[0].id,
        kind: 'initial_roster',
        acquisitionYear: 2025,
        originalTeam: 'Test State',
      });
      expect(await db.getAll('seasonMemories')).toEqual([]);
      expect(await loadNonCon()).toEqual(result);
    },
  );

  it.each([
    {
      name: 'unsupported year',
      input: { ...buildInput(), year: '1999' },
      message: 'The 1999 season is not supported.',
    },
    {
      name: 'unknown team',
      input: { ...buildInput(), teamName: 'Missing State' },
      message: 'Missing State is not available in the 2025 season.',
    },
    {
      name: 'unsupported playoff size',
      input: {
        ...buildInput(),
        playoff: { ...buildInput().playoff, teams: 8 },
      } as unknown as StartNewLeagueInput,
      message: 'The playoff must contain 2, 4, or 12 teams.',
    },
    {
      name: 'too many automatic bids',
      input: {
        ...buildInput(),
        playoff: { ...buildInput().playoff, autobids: 11 },
      },
      message: 'between 0 and 10 automatic bids',
    },
    {
      name: 'top seeds without four automatic bids',
      input: {
        ...buildInput(),
        playoff: { ...buildInput().playoff, autobids: 3 },
      },
      message: 'requires at least four automatic bids',
    },
  ])('rejects $name without replacing the existing league', async ({ input, message }) => {
    await seedExistingLeague();
    await expect(startNewLeague(input)).rejects.toThrow(message);

    const db = await getDb();
    expect((await db.get('league', 'current'))?.value).toEqual(
      buildTestLeague('season'),
    );
    expect(await db.getAll('players')).toEqual([
      buildTestPlayer({ id: 99 }),
    ]);
    expect(await db.getAll('games')).toEqual([buildOldGame()]);
    expect(await db.getAll('gameDetails')).toHaveLength(1);
    expect(await db.getAll('playerSeasons')).toHaveLength(1);
    expect(await db.getAll('historicalPlayers')).toHaveLength(1);
  });

  it('keeps the existing league after preparation failure and succeeds on retry', async () => {
    await seedExistingLeague();
    const names = responses.get('/data/names.json');
    responses.delete('/data/names.json');

    await expect(startNewLeague(buildInput())).rejects.toThrow(
      'Failed to load /data/names.json: 404',
    );

    const db = await getDb();
    expect((await db.get('league', 'current'))?.value).toEqual(
      buildTestLeague('season'),
    );
    expect(await db.getAll('players')).toEqual([
      buildTestPlayer({ id: 99 }),
    ]);
    expect(await db.getAll('games')).toEqual([buildOldGame()]);
    expect(await db.getAll('gameDetails')).toHaveLength(1);
    expect(await db.getAll('playerSeasons')).toHaveLength(1);
    expect(await db.getAll('historicalPlayers')).toHaveLength(1);

    responses.set('/data/names.json', names);
    await expect(startNewLeague(buildInput())).resolves.toMatchObject({
      info: { stage: 'preseason', team: 'Test State' },
    });
  });
});
