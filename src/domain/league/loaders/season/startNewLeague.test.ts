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
import { loadDashboard } from './loadDashboard';
import { loadNonCon } from './loadNonCon';
import { loadTeamSchedule } from './loadTeamSchedule';
import { startNewLeague } from './startNewLeague';

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
    'drives',
    'plays',
    'gameLogs',
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
    drives: await db.getAll('drives'),
    plays: await db.getAll('plays'),
    gameLogs: await db.getAll('gameLogs'),
  };
};

const buildOldGame = (): GameRecord => ({
  id: 99,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
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
  await db.put('drives', {
    id: 99,
    gameId: 99,
    driveNum: 1,
    offenseId: 1,
    defenseId: 2,
    startingFP: 25,
    result: 'Touchdown',
    points: 7,
    points_needed: 7,
    scoreAAfter: 7,
    scoreBAfter: 0,
  });
  await db.put('plays', {
    id: 99,
    gameId: 99,
    driveId: 99,
    offenseId: 1,
    defenseId: 2,
    startingFP: 25,
    down: 1,
    yardsLeft: 10,
    playType: 'run',
    yardsGained: 5,
    result: 'gain',
    text: 'Run for five',
    header: '1st & 10',
    scoreA: 0,
    scoreB: 0,
  });
  await db.put('gameLogs', {
    id: 99,
    playerId: 99,
    gameId: 99,
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
};

const buildInput = (
  teams: 2 | 4 | 12 = 12,
): StartNewLeagueInput => ({
  teamName: 'Test State',
  year: '2025',
  playoff: {
    teams,
    autobids: teams === 12 ? 5 : undefined,
    conferenceChampionsReceiveTopSeeds: teams === 12,
  },
});

beforeEach(async () => {
  responses = baseResponses();
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
    expect(fetch).toHaveBeenCalledWith('/data/history.json');
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
      expect(await db.getAll('drives')).toEqual([]);
      expect(await db.getAll('plays')).toEqual([]);
      expect(await db.getAll('gameLogs')).toEqual([]);
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
    expect(await db.getAll('drives')).toHaveLength(1);
    expect(await db.getAll('plays')).toHaveLength(1);
    expect(await db.getAll('gameLogs')).toHaveLength(1);
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
    expect(await db.getAll('drives')).toHaveLength(1);
    expect(await db.getAll('plays')).toHaveLength(1);
    expect(await db.getAll('gameLogs')).toHaveLength(1);

    responses.set('/data/names.json', names);
    await expect(startNewLeague(buildInput())).resolves.toMatchObject({
      info: { stage: 'preseason', team: 'Test State' },
    });
  });
});
