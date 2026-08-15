import { describe, expect, it } from 'vitest';
import {
  buildTestPlayCall,
  buildTestPlayer,
  buildTestPlayParticipants,
  buildTestPlayTiming,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
} from '../../test/fixtures';
import type { DriveRecord, GameLogRecord, PlayRecord } from '../../types/db';
import type { SeasonMemory } from '../../types/memory';
import {
  buildGameDetail,
  buildPlayerSeasons,
  flattenGameDetail,
  PLAYER_SEASON_STAT_KEYS,
  selectRetainedGameIds,
} from './gameDetails';

const log = (playerId: number, value: number): GameLogRecord => ({
  playerId,
  gameId: 10,
  pass_yards: value,
  pass_attempts: value,
  pass_completions: value,
  pass_touchdowns: value,
  pass_interceptions: value,
  rush_yards: value,
  rush_attempts: value,
  rush_touchdowns: value,
  receiving_yards: value,
  receiving_catches: value,
  receiving_touchdowns: value,
  fumbles: value,
  tackles: value,
  sacks: value,
  interceptions: value,
  fumbles_forced: value,
  fumbles_recovered: value,
  field_goals_made: value,
  field_goals_attempted: value,
  extra_points_made: value,
  extra_points_attempted: value,
});

describe('game detail persistence projections', () => {
  it('nests drives and normalized plays without repeated persisted identities', () => {
    const drive: DriveRecord = {
      id: 100,
      gameId: 10,
      driveNum: 1,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      result: 'touchdown',
      points: 7,
      points_needed: 0,
      scoreAAfter: 7,
      scoreBAfter: 0,
    };
    const play: PlayRecord = {
      id: 1001,
      gameId: 10,
      driveId: 100,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      down: 1,
      yardsLeft: 10,
      playType: 'run',
      yardsGained: 75,
      result: 'touchdown',
      text: 'Touchdown',
      header: '1st & 10',
      scoreA: 7,
      scoreB: 0,
      call: buildTestPlayCall(),
      participants: buildTestPlayParticipants({ rusherId: 1 }),
      timing: buildTestPlayTiming(),
    };
    const detail = buildGameDetail(10, 2025, [drive], [play], [log(1, 1)]);

    expect(detail.drives[0]).not.toHaveProperty('id');
    expect(detail.drives[0]).not.toHaveProperty('gameId');
    expect(detail.drives[0].plays[0]).not.toHaveProperty('id');
    expect(detail.drives[0].plays[0]).not.toHaveProperty('gameId');
    expect(detail.drives[0].plays[0]).not.toHaveProperty('driveId');
    expect(detail.drives[0].plays[0]).toMatchObject({
      timing: buildTestPlayTiming(),
      call: buildTestPlayCall(),
      participants: buildTestPlayParticipants({ rusherId: 1 }),
    });
    expect(flattenGameDetail(detail)).toMatchObject({
      drives: [{ gameId: 10, offenseId: 1, defenseId: 2 }],
      plays: [{
        gameId: 10,
        offenseId: 1,
        defenseId: 2,
        call: buildTestPlayCall(),
        participants: buildTestPlayParticipants({ rusherId: 1 }),
      }],
      logs: [{ gameId: 10, playerId: 1 }],
    });
  });

  it('sums every raw stat field into one annual record per logged player', () => {
    const first = buildGameDetail(10, 2025, [], [], [log(1, 1)]);
    const second = buildGameDetail(
      11,
      2025,
      [],
      [],
      [{ ...log(1, 2), gameId: 11 }, { ...log(2, 4), gameId: 11 }],
    );
    const seasons = buildPlayerSeasons(
      2025,
      [first, second],
      [
        buildTestPlayer({ id: 1, teamId: 1 }),
        buildTestPlayer({ id: 2, teamId: 2, pos: 'rb' }),
      ],
    );

    expect(seasons).toHaveLength(2);
    expect(seasons[0]).toMatchObject({
      year: 2025,
      playerId: 1,
      teamId: 1,
      starter: true,
      games: 2,
    });
    PLAYER_SEASON_STAT_KEYS.forEach(key => {
      expect(seasons[0][key]).toBe(3);
      expect(seasons[1][key]).toBe(4);
    });
  });

  it('retains every user game and every major postseason event, but not AI bowls', () => {
    const memory: SeasonMemory = buildTestSeasonMemory({
      teamSnapshots: [
        buildTestSeasonTeamSnapshot(),
      ],
      postseason: {
        playoff: {
          format: 2,
          seeds: [6, 7],
          autobids: 0,
          conferenceChampionsReceiveTopSeeds: false,
          games: { championship: 4 },
        },
        conferenceChampions: [{
          conferenceName: 'Big',
          teamId: 2,
          championshipGameId: 2,
        }],
        bowls: [{ gameId: 3, name: 'AI Bowl', tier: 'other' }],
      },
    });
    const retained = selectRetainedGameIds(
      1,
      [
        { id: 1, teamAId: 1, teamBId: 9 },
        { id: 2, teamAId: 2, teamBId: 3 },
        { id: 3, teamAId: 4, teamBId: 5 },
        { id: 4, teamAId: 6, teamBId: 7 },
      ],
      memory,
    );
    expect([...retained].sort()).toEqual([1, 2, 4]);
  });
});
