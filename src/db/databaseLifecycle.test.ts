import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildRecruitingState } from '../test/recruitingFixtures';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../test/fixtures';
import type { GameRecord } from '../types/db';
import type { LeagueState } from '../types/league';
import type { RecruitingState } from '../types/recruiting';
import {
  DB_NAME,
  DB_VERSION,
  deleteCurrentDatabase,
  getDb,
} from './db';
import { initializeDatabase } from './databaseLifecycle';

const resetDatabase = async () => {
  await deleteCurrentDatabase();
  await getDb();
};

const currentSaveCounts = async () => {
  const db = await getDb();
  return Promise.all([
    db.count('league'),
    db.count('recruiting'),
    db.count('players'),
    db.count('games'),
    db.count('gameDetails'),
    db.count('newsItems'),
    db.count('playerSeasons'),
    db.count('historicalPlayers'),
    db.count('playerOrigins'),
    db.count('seasonMemories'),
  ]);
};

const upcomingGame = (): GameRecord => ({
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
  year: 2025,
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
});

describe('database startup lifecycle', () => {
  beforeEach(resetDatabase);

  it('preserves a valid current save', async () => {
    const db = await getDb();
    const league = buildTestLeague('season');
    const player = buildTestPlayer();
    await db.put('league', { key: 'current', value: league });
    await db.put('players', player);
    await db.put('playerOrigins', {
      playerId: player.id,
      kind: 'initial_roster',
      acquisitionYear: league.info.startYear,
      originalTeamId: player.teamId,
      classAtStart: player.year,
    });

    await initializeDatabase();

    const current = await getDb();
    expect((await current.get('league', 'current'))?.value).toEqual(league);
    expect(await current.get('players', player.id)).toEqual(player);
  });

  it('deletes the database when the current league is malformed', async () => {
    const db = await getDb();
    const malformed = buildTestLeague('season');
    delete (malformed as Partial<LeagueState>).settings;
    await db.put('league', { key: 'current', value: malformed });
    await db.put('players', buildTestPlayer());
    await db.put('baseData', { key: 'marker', value: 'discarded' });

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await (await getDb()).get('baseData', 'marker')).toBeUndefined();
  });

  it('requires the current seasonal rivalry opt-out state', async () => {
    const db = await getDb();
    const malformed = buildTestLeague('season');
    delete (malformed as Partial<LeagueState>).declinedRivalries;
    await db.put('league', { key: 'current', value: malformed });
    await db.put('players', buildTestPlayer());

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when the current roster is malformed', async () => {
    const db = await getDb();
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('season'),
    });
    await db.put('players', buildTestPlayer({ first: '' }));

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when a persisted game is malformed', async () => {
    const db = await getDb();
    const teamA = buildTestTeam();
    const teamB = buildTestTeam({
      id: 2,
      name: 'Other State',
      abbreviation: 'OTH',
      ranking: 2,
    });
    const base = buildTestLeague('season');
    const league = buildTestLeague('season', {
      teams: [teamA, teamB],
      conferences: [{ ...base.conferences[0], teams: [teamA, teamB] }],
    });
    await db.put('league', { key: 'current', value: league });
    await db.put('players', buildTestPlayer());
    await db.put('players', buildTestPlayer({ id: 2, teamId: 2 }));
    await db.put('playerOrigins', {
      playerId: 1,
      kind: 'initial_roster',
      acquisitionYear: 2025,
      originalTeamId: 1,
      classAtStart: 'jr',
    });
    await db.put('playerOrigins', {
      playerId: 2,
      kind: 'initial_roster',
      acquisitionYear: 2025,
      originalTeamId: 2,
      classAtStart: 'jr',
    });
    await db.put('games', {
      ...upcomingGame(),
      legacyClock: 900,
    } as unknown as GameRecord);

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when a persisted game detail is malformed', async () => {
    const db = await getDb();
    const teamA = buildTestTeam();
    const teamB = buildTestTeam({
      id: 2,
      name: 'Other State',
      abbreviation: 'OTH',
      ranking: 2,
    });
    const base = buildTestLeague('season');
    const league = buildTestLeague('season', {
      teams: [teamA, teamB],
      conferences: [{ ...base.conferences[0], teams: [teamA, teamB] }],
    });
    await db.put('league', { key: 'current', value: league });
    await db.put('players', buildTestPlayer());
    await db.put('players', buildTestPlayer({ id: 2, teamId: 2 }));
    await db.put('games', upcomingGame());
    await db.put('gameDetails', {
      gameId: 1,
      year: 2025,
      drives: [],
      playerStats: [],
    });

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when a player origin is missing or orphaned', async () => {
    const db = await getDb();
    const league = buildTestLeague('season');
    const player = buildTestPlayer();
    await db.put('league', { key: 'current', value: league });
    await db.put('players', player);

    await initializeDatabase();
    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const current = await getDb();
    await current.put('playerOrigins', {
      playerId: 999,
      kind: 'walk_on',
      acquisitionYear: league.info.startYear,
      originalTeamId: player.teamId,
    });
    await initializeDatabase();
    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes the database when recruiting state is malformed', async () => {
    const db = await getDb();
    const malformed = {
      ...buildRecruitingState(),
      version: undefined,
    } as unknown as RecruitingState;
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('recruiting'),
    });
    await db.put('players', buildTestPlayer());
    await db.put('recruiting', { key: 'current', value: malformed });

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deletes orphaned save records without a league', async () => {
    const db = await getDb();
    await db.put('players', buildTestPlayer());

    await initializeDatabase();

    expect(await currentSaveCounts()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('recreates a malformed current-version store schema', async () => {
    await deleteCurrentDatabase();
    const malformed = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('league', { keyPath: 'key' });
      },
    });
    malformed.close();

    await initializeDatabase();

    const current = await getDb();
    expect(Array.from(current.objectStoreNames)).toEqual([
      'baseData',
      'gameDetails',
      'games',
      'historicalPlayers',
      'league',
      'newsItems',
      'playerOrigins',
      'playerSeasons',
      'players',
      'recruiting',
      'seasonMemories',
    ]);
  });
});
