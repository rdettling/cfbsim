import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCurrentDatabase, getDb } from '../../db/db';
import { initializeDatabase } from '../../db/databaseLifecycle';
import { buildGameDetail } from '../league/gameDetails';
import {
  buildTestLeague,
  buildTestPlayParticipants,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import type { GameLogRecord, GameRecord } from '../../types/db';
import { finalizeCompletedSeasonIfReady } from './seasonCompletion';

const stats: GameLogRecord = {
  playerId: 1,
  gameId: 1,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 120,
  rush_attempts: 20,
  rush_touchdowns: 2,
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
};

describe('completed season finalization', () => {
  beforeEach(async () => {
    await deleteCurrentDatabase();
    await getDb();
  });

  it('persists finalized artifacts before exposing the summary stage', async () => {
    const db = await getDb();
    const teamA = buildTestTeam();
    const teamB = buildTestTeam({
      id: 2,
      name: 'Other State',
      abbreviation: 'OTH',
      ranking: 2,
    });
    const base = buildTestLeague('season');
    const summaryTemplate = buildTestLeague('summary', {
      teams: [teamA, teamB],
      settings: { ...base.settings, playoffTeams: 2, playoffAutobids: 0 },
    });
    const league = buildTestLeague('season', {
      teams: [teamA, teamB],
      conferences: [{ ...base.conferences[0], teams: [teamA, teamB] }],
      settings: { ...base.settings, playoffTeams: 2, playoffAutobids: 0 },
      playoff: { seeds: [1, 2], natty: 1 },
      resumeSnapshot: summaryTemplate.resumeSnapshot,
      idCounters: { game: 2, player: 3 },
    });
    const championship: GameRecord = {
      id: 1,
      teamAId: 1,
      teamBId: 2,
      homeTeamId: null,
      awayTeamId: null,
      neutralSite: true,
      venue: null,
      winnerId: 1,
      baseLabel: 'National Championship',
      name: 'National Championship',
      gameType: 'national_championship',
      rivalryKey: null,
      spreadA: '-3',
      spreadB: '+3',
      moneylineA: '-150',
      moneylineB: '+130',
      winProbA: 0.6,
      winProbB: 0.4,
      weekPlayed: 16,
      year: league.info.currentYear,
      rankATOG: 1,
      rankBTOG: 2,
      resultA: 'W',
      resultB: 'L',
      overtime: 0,
      quarter: 4,
      clockSecondsLeft: 0,
      scoreA: 6,
      scoreB: 0,
      watchability: 90,
    };
    await db.put('league', { key: 'current', value: league });
    await db.put('players', buildTestPlayer({ id: 1, teamId: 1, pos: 'rb' }));
    await db.put('players', buildTestPlayer({ id: 2, teamId: 2, pos: 'rb' }));
    await db.put('playerOrigins', {
      playerId: 1,
      kind: 'initial_roster',
      acquisitionYear: league.info.startYear,
      originalTeamId: 1,
      classAtStart: 'jr',
    });
    await db.put('playerOrigins', {
      playerId: 2,
      kind: 'initial_roster',
      acquisitionYear: league.info.startYear,
      originalTeamId: 2,
      classAtStart: 'jr',
    });
    await db.put('games', championship);
    await db.put('newsItems', {
      id: 'game:1',
      type: 'game',
      year: league.info.currentYear,
      week: championship.weekPlayed,
      headline: 'Test State wins the national championship',
      deck: 'Test State finished the season with a championship victory.',
      importance: 100,
      gameId: 1,
      teamIds: [1, 2],
      featuredPlayerId: 1,
      primaryAngle: 'championship',
      storylines: ['championship'],
    });
    await db.put('gameDetails', buildGameDetail(
      1,
      league.info.currentYear,
      [{
        id: 1,
        gameId: 1,
        driveNum: 0,
        offenseId: 1,
        defenseId: 2,
        startingFP: 94,
        result: 'touchdown',
        points: 6,
        scoreAAfter: 6,
        scoreBAfter: 0,
      }],
      [{
        id: 1,
        gameId: 1,
        driveId: 1,
        offenseId: 1,
        defenseId: 2,
        startingFP: 94,
        down: 1,
        yardsLeft: 6,
        playType: 'run',
        yardsGained: 6,
        result: 'touchdown',
        text: 'Test State scored.',
        header: '1st and goal',
        scoreA: 0,
        scoreB: 0,
        call: { kind: 'scrimmage', offense: 'inside_run', defense: 'base' },
        participants: buildTestPlayParticipants({ rusherId: 1 }),
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
      [stats],
    ));

    await expect(finalizeCompletedSeasonIfReady(league)).resolves.toBe(true);

    expect(league.info.stage).toBe('summary');
    expect(((await db.get('league', 'current'))?.value as typeof league).info.stage)
      .toBe('summary');
    expect(await db.get('seasonMemories', league.info.currentYear)).toMatchObject({
      year: league.info.currentYear,
      postseason: { playoff: { format: 2, games: { championship: 1 } } },
    });
    expect(await db.getAllFromIndex('playerSeasons', 'year', league.info.currentYear))
      .toHaveLength(1);
    await initializeDatabase();
    expect((await (await getDb()).get('league', 'current'))?.value).toBeDefined();
    await expect(finalizeCompletedSeasonIfReady(league)).resolves.toBe(false);
    expect(await db.count('seasonMemories')).toBe(1);
  });
});
