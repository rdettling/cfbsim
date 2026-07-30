import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameRecord, PlayerRecord } from '../types/db';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';
import { getDb } from './db';
import { commitNewLeague } from './newLeagueRepo';
import { buildRecruitingState } from '../test/recruitingFixtures';

const buildTestGame = (): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  winnerId: null,
  baseLabel: 'Test State vs Other State',
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
  resultA: null,
  resultB: null,
  overtime: 0,
  scoreA: null,
  scoreB: null,
  headline: null,
  watchability: 80,
});

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
  ] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

describe('commitNewLeague', () => {
  beforeEach(resetDatabase);

  it('replaces the league and all simulation stores together', async () => {
    const db = await getDb();
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('season'),
    });
    await db.put('recruiting', {
      key: 'current',
      value: buildRecruitingState(),
    });
    await db.put('players', buildTestPlayer({ id: 99 }));
    await db.put('games', { ...buildTestGame(), id: 99 });
    await db.put('gameDetails', {
      gameId: 99,
      year: 2025,
      drives: [],
      playerStats: [],
    });
    await db.put('playerOrigins', {
      playerId: 99,
      kind: 'walk_on',
      acquisitionYear: 2025,
      originalTeamId: 1,
    });

    const nextLeague = buildTestLeague('preseason');
    const nextPlayer = buildTestPlayer({ id: 1, year: 'fr' });
    const nextGame = buildTestGame();
    await commitNewLeague({
      league: nextLeague,
      players: [nextPlayer],
      games: [nextGame],
      playerOrigins: [{
        playerId: nextPlayer.id,
        kind: 'initial_roster',
        acquisitionYear: nextLeague.info.startYear,
        originalTeamId: nextPlayer.teamId,
        classAtStart: nextPlayer.year,
      }],
    });

    expect((await db.get('league', 'current'))?.value).toEqual(nextLeague);
    expect(await db.getAll('players')).toEqual([nextPlayer]);
    expect(await db.getAll('games')).toEqual([nextGame]);
    expect(await db.getAll('gameDetails')).toEqual([]);
    expect(await db.getAll('playerSeasons')).toEqual([]);
    expect(await db.getAll('historicalPlayers')).toEqual([]);
    expect(await db.getAll('playerOrigins')).toEqual([{
      playerId: nextPlayer.id,
      kind: 'initial_roster',
      acquisitionYear: nextLeague.info.startYear,
      originalTeamId: nextPlayer.teamId,
      classAtStart: nextPlayer.year,
    }]);
    expect(await db.getAll('recruiting')).toEqual([]);
  });

  it('rolls back cleared stores when a prepared record cannot be written', async () => {
    const db = await getDb();
    const oldLeague = buildTestLeague('season');
    const oldPlayer = buildTestPlayer({ id: 99 });
    const oldGame = { ...buildTestGame(), id: 99 };
    const oldRecruiting = buildRecruitingState();
    await db.put('league', { key: 'current', value: oldLeague });
    await db.put('recruiting', {
      key: 'current',
      value: oldRecruiting,
    });
    await db.put('players', oldPlayer);
    await db.put('games', oldGame);

    await expect(
      commitNewLeague({
        league: buildTestLeague('preseason'),
        players: [{} as PlayerRecord],
        games: [],
        playerOrigins: [],
      }),
    ).rejects.toBeDefined();

    expect((await db.get('league', 'current'))?.value).toEqual(oldLeague);
    expect(await db.getAll('players')).toEqual([oldPlayer]);
    expect(await db.getAll('games')).toEqual([oldGame]);
    expect((await db.get('recruiting', 'current'))?.value).toEqual(
      oldRecruiting,
    );
  });
});
