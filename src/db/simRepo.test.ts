import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildTestLeague,
  buildTestPlayParticipants,
  buildTestPlayer,
  buildTestPlayerSeason,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../test/fixtures';
import type { GameDetailRecord, GameRecord } from '../types/db';
import { getDb } from './db';
import {
  commitSimulationBatch,
  commitSeasonCompletion,
  commitSeasonInitialization,
  getAllGameDetails,
  getAllGameLogs,
  getAllPlays,
  getDrivesByGame,
  getAllGames,
  getGameDetail,
  getGameById,
  getGamesByTeam,
  getGamesByWeek,
  getGamesByYear,
  saveGamesAndLeague,
} from './simRepo';

const zeroStats = (playerId: number) => ({
  playerId,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 6,
  rush_attempts: 1,
  rush_touchdowns: 1,
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

const detail = (): GameDetailRecord => ({
  gameId: 1,
  year: 2026,
  drives: [{
    driveNum: 0,
    offenseId: 1,
    defenseId: 2,
    startingFP: 94,
    result: 'touchdown',
    points: 6,
    scoreAAfter: 6,
    scoreBAfter: 0,
    plays: [{
      startingFP: 94,
      down: 1,
      yardsLeft: 6,
      playType: 'run',
      yardsGained: 6,
      result: 'touchdown',
      text: 'Runner scored.',
      header: '1st and goal',
      scoreA: 0,
      scoreB: 0,
      call: { kind: 'scrimmage', offense: 'inside_run', defense: 'base' },
      participants: buildTestPlayParticipants({ rusherId: 10 }),
      timing: {
        kind: 'regulation',
        start: { quarter: 4, secondsLeft: 6, running: true },
        end: { quarter: 4, secondsLeft: 0, running: false },
        elapsedSeconds: 6,
        outOfBounds: false,
        tempo: 'normal',
        eventAfter: 'end_of_regulation',
        chargedTimeoutAfter: null,
      },
    }],
  }],
  playerStats: [zeroStats(10)],
});

const game = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: null,
  baseLabel: 'Test State vs Other State',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 1,
  year: 2026,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: null,
  resultB: null,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  scoreA: null,
  scoreB: null,
  watchability: 75,
  ...overrides,
});

const league = () => {
  const teamA = buildTestTeam();
  const teamB = buildTestTeam({
    id: 2,
    name: 'Other State',
    abbreviation: 'OTH',
    ranking: 2,
  });
  const base = buildTestLeague('season');
  return buildTestLeague('season', {
    info: { ...base.info, currentYear: 2026 },
    teams: [teamA, teamB],
    conferences: [{ ...base.conferences[0], teams: [teamA, teamB] }],
    idCounters: { ...base.idCounters, game: 3, player: 100 },
  });
};

const clearStores = async () => {
  const db = await getDb();
  const tx = db.transaction([
    'games',
    'league',
    'gameDetails',
    'newsItems',
    'players',
    'historicalPlayers',
    'seasonMemories',
    'playerSeasons',
  ], 'readwrite');
  await Promise.all([
    tx.objectStore('games').clear(),
    tx.objectStore('league').clear(),
    tx.objectStore('gameDetails').clear(),
    tx.objectStore('newsItems').clear(),
    tx.objectStore('players').clear(),
    tx.objectStore('historicalPlayers').clear(),
    tx.objectStore('seasonMemories').clear(),
    tx.objectStore('playerSeasons').clear(),
  ]);
  await tx.done;
};

describe('game repository boundary', () => {
  beforeEach(clearStores);

  it('accepts exact records through every game reader', async () => {
    await (await getDb()).put('games', game());
    await expect(getAllGames()).resolves.toEqual([game()]);
    await expect(getGamesByYear(2026)).resolves.toEqual([game()]);
    await expect(getGamesByTeam(1)).resolves.toEqual([game()]);
    await expect(getGamesByWeek(1)).resolves.toEqual([game()]);
    await expect(getGameById(1)).resolves.toEqual(game());
    await expect(getGameById(999)).resolves.toBeUndefined();
  });

  it.each([
    ['all games', () => getAllGames()],
    ['year index', () => getGamesByYear(2026)],
    ['team indexes', () => getGamesByTeam(1)],
    ['week index', () => getGamesByWeek(1)],
    ['game ID', () => getGameById(1)],
  ])('rejects malformed records from %s', async (_label, read) => {
    await (await getDb()).put('games', {
      ...game(),
      legacyClock: 900,
    } as unknown as GameRecord);
    await expect(read()).rejects.toMatchObject({ code: 'INVALID_GAME_RECORD' });
  });

  it.each([
    ['game-and-league scheduling', (nextLeague: ReturnType<typeof league>, invalid: GameRecord) =>
      saveGamesAndLeague([invalid], nextLeague)],
    ['simulation batch', (nextLeague: ReturnType<typeof league>, invalid: GameRecord) =>
      commitSimulationBatch({ league: nextLeague, games: [invalid], details: [] })],
  ])('rejects an invalid %s batch without changing stored records', async (
    _label,
    write,
  ) => {
    const db = await getDb();
    const existingLeague = league();
    const existingGame = game();
    await db.put('league', { key: 'current', value: existingLeague });
    await db.put('games', existingGame);
    const invalid = {
      ...game({ id: 2 }),
      watchability: Number.NaN,
    };

    await expect(write(league(), invalid)).rejects.toMatchObject({
      code: 'INVALID_GAME_RECORD',
    });
    expect(await db.getAll('games')).toEqual([existingGame]);
    expect((await db.get('league', 'current'))?.value).toEqual(existingLeague);
    expect(await db.getAll('gameDetails')).toEqual([]);
    expect(await db.getAll('newsItems')).toEqual([]);
  });

  it('validates exact detail records through every direct and derived reader', async () => {
    const db = await getDb();
    await db.put('gameDetails', detail());
    await expect(getGameDetail(1)).resolves.toEqual(detail());
    await expect(getAllGameDetails()).resolves.toEqual([detail()]);
    await expect(getDrivesByGame(1)).resolves.toHaveLength(1);
    await expect(getAllPlays()).resolves.toHaveLength(1);
    await expect(getAllGameLogs()).resolves.toHaveLength(1);

    await db.put('gameDetails', {
      ...detail(),
      legacyPlays: [],
    } as unknown as GameDetailRecord);
    await expect(getGameDetail(1)).rejects.toMatchObject({
      code: 'INVALID_GAME_DETAIL_RECORD',
    });
  });

  it('aborts a malformed detail batch without changing any participating store', async () => {
    const db = await getDb();
    const existingLeague = league();
    const existingGame = game();
    await db.put('league', { key: 'current', value: existingLeague });
    await db.put('games', existingGame);
    await db.put('players', buildTestPlayer({ id: 10, teamId: 1, pos: 'rb', starter: true }));
    await db.put('players', buildTestPlayer({ id: 20, teamId: 2, pos: 'rb', starter: true }));
    const completed = game({
      winnerId: 1,
      resultA: 'W',
      resultB: 'L',
      scoreA: 6,
      scoreB: 0,
      quarter: 4,
      clockSecondsLeft: 0,
    });
    const invalidDetail = structuredClone(detail());
    invalidDetail.drives[0].scoreAAfter = 7;

    await expect(commitSimulationBatch({
      league: existingLeague,
      games: [completed],
      details: [invalidDetail],
    })).rejects.toMatchObject({ code: 'INVALID_GAME_DETAIL_RECORD' });
    expect(await db.getAll('games')).toEqual([existingGame]);
    expect(await db.getAll('gameDetails')).toEqual([]);
    expect(await db.getAll('newsItems')).toEqual([]);
    expect((await db.get('league', 'current'))?.value).toEqual(existingLeague);
  });

  it('commits a valid completed game and exact nested detail atomically', async () => {
    const db = await getDb();
    const nextLeague = league();
    await db.put('players', buildTestPlayer({ id: 10, teamId: 1, pos: 'rb', starter: true }));
    await db.put('players', buildTestPlayer({ id: 20, teamId: 2, pos: 'rb', starter: true }));
    const completed = game({
      winnerId: 1,
      resultA: 'W',
      resultB: 'L',
      scoreA: 6,
      scoreB: 0,
      quarter: 4,
      clockSecondsLeft: 0,
    });

    await commitSimulationBatch({
      league: nextLeague,
      games: [completed],
      details: [detail()],
    });

    expect(await db.get('games', 1)).toEqual(completed);
    expect(await db.get('gameDetails', 1)).toEqual(detail());
    expect((await db.get('league', 'current'))?.value).toEqual(nextLeague);
  });

  it('atomically commits finalized artifacts with the summary transition', async () => {
    const db = await getDb();
    const source = league();
    source.playoff = { seeds: [1, 2], natty: 1 };
    const destination = structuredClone(source);
    destination.info.stage = 'summary';
    const championship = game({
      gameType: 'national_championship',
      name: 'National Championship',
      neutralSite: true,
      homeTeamId: null,
      awayTeamId: null,
      winnerId: 1,
      resultA: 'W',
      resultB: 'L',
      scoreA: 6,
      scoreB: 0,
      quarter: 4,
      clockSecondsLeft: 0,
    });
    const player = buildTestPlayer({ id: 10, teamId: 1, pos: 'rb' });
    const opponent = buildTestPlayer({ id: 20, teamId: 2, pos: 'rb' });
    const memory = buildTestSeasonMemory({
      year: 2026,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot({ teamId: 1 }),
        buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2 }),
      ],
    });
    const playerSeason = buildTestPlayerSeason({
      year: 2026,
      playerId: player.id,
      teamId: player.teamId,
      position: player.pos,
    });
    await db.put('league', { key: 'current', value: source });
    await db.put('games', championship);
    await db.put('players', player);
    await db.put('players', opponent);

    await commitSeasonCompletion({
      league: destination,
      memory,
      playerSeasons: [playerSeason],
    });

    expect((await db.get('league', 'current'))?.value).toEqual(destination);
    expect(await db.get('seasonMemories', 2026)).toEqual(memory);
    expect(await db.getAll('playerSeasons')).toEqual([playerSeason]);
    await expect(commitSeasonCompletion({
      league: destination,
      memory,
      playerSeasons: [playerSeason],
    })).rejects.toThrow('no longer ready');
    expect(await db.count('seasonMemories')).toBe(1);
  });

  it('rolls back season completion when finalized artifacts are invalid', async () => {
    const db = await getDb();
    const source = league();
    source.playoff = { seeds: [1, 2], natty: 1 };
    const destination = structuredClone(source);
    destination.info.stage = 'summary';
    const championship = game({
      gameType: 'national_championship',
      name: 'National Championship',
      winnerId: 1,
      resultA: 'W',
      resultB: 'L',
      scoreA: 6,
      scoreB: 0,
      quarter: 4,
      clockSecondsLeft: 0,
    });
    const player = buildTestPlayer({ id: 10, teamId: 1, pos: 'rb' });
    await db.put('league', { key: 'current', value: source });
    await db.put('games', championship);
    await db.put('players', player);
    await db.put('players', buildTestPlayer({ id: 20, teamId: 2, pos: 'rb' }));

    await expect(commitSeasonCompletion({
      league: destination,
      memory: buildTestSeasonMemory({
        year: 2026,
        teamSnapshots: [
          buildTestSeasonTeamSnapshot({ teamId: 1 }),
          buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2 }),
        ],
      }),
      playerSeasons: [buildTestPlayerSeason({
        year: 2026,
        playerId: 999,
        teamId: 1,
      })],
    })).rejects.toBeDefined();

    expect((await db.get('league', 'current'))?.value).toEqual(source);
    expect(await db.getAll('seasonMemories')).toEqual([]);
    expect(await db.getAll('playerSeasons')).toEqual([]);
  });

  it('clears prior details only as part of a valid season-initialization commit', async () => {
    const db = await getDb();
    await db.put('gameDetails', detail());
    const nextLeague = league();
    await expect(commitSeasonInitialization({
      year: 2026,
      league: nextLeague,
      games: [{ ...game(), watchability: Number.NaN }],
    })).rejects.toMatchObject({ code: 'INVALID_GAME_RECORD' });
    expect(await db.getAll('gameDetails')).toEqual([detail()]);

    await commitSeasonInitialization({
      year: 2026,
      league: nextLeague,
      games: [game()],
    });
    expect(await db.getAll('gameDetails')).toEqual([]);
    expect(await db.getAll('games')).toEqual([game()]);
  });
});
