import { describe, expect, it } from 'vitest';
import {
  buildTestPlayCall,
  buildTestPlayer,
  buildTestPlayParticipants,
  buildTestPlayTiming,
} from '../test/fixtures';
import type { DriveRecord, PlayRecord, PlayTiming } from '../types/db';
import {
  buildGameDetail,
  buildPlayerSeasons,
  flattenGameDetail,
} from '../domain/league/gameDetails';
import {
  assertHistoricalIntegrity,
  isGameDetail,
  isHistoricalPlayer,
  isPlayTiming,
  isPlayerSeason,
} from './historyRepo';

describe('historical data integrity', () => {
  const current = buildTestPlayer();
  const detail = buildGameDetail(1, 2025, [], [], []);
  const season = buildPlayerSeasons(
    2025,
    [
      buildGameDetail(1, 2025, [], [], [{
        playerId: 1,
        gameId: 1,
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
        tackles: 1,
        sacks: 0,
        interceptions: 0,
        fumbles_forced: 0,
        fumbles_recovered: 0,
        field_goals_made: 0,
        field_goals_attempted: 0,
        extra_points_made: 0,
        extra_points_attempted: 0,
      }]),
    ],
    [current],
  )[0];

  it('accepts exact current records and rejects fallback fields', () => {
    expect(isGameDetail(detail)).toBe(true);
    expect(isPlayerSeason(season)).toBe(true);
    expect(
      isHistoricalPlayer({
        id: 2,
        first: 'Past',
        last: 'Player',
        pos: 'lb',
        stars: 4,
        development_trait: 3,
      }),
    ).toBe(true);
    expect(isGameDetail({ ...detail, legacyPlays: [] })).toBe(false);
    expect(isPlayerSeason({ ...season, completionPercentage: 0 })).toBe(false);
    expect(isPlayerSeason({ ...season, starter: undefined })).toBe(false);
  });

  it('rejects duplicate identities and dangling references', () => {
    expect(() =>
      assertHistoricalIntegrity({
        currentPlayers: [current],
        historicalPlayers: [{
          id: current.id,
          first: current.first,
          last: current.last,
          pos: current.pos,
          stars: current.stars,
          development_trait: current.development_trait,
        }],
        playerSeasons: [season],
        details: [detail],
        gameIds: new Set([1]),
      }),
    ).toThrow(/multiple stores/);
    expect(() =>
      assertHistoricalIntegrity({
        currentPlayers: [],
        historicalPlayers: [],
        playerSeasons: [season],
        details: [],
        gameIds: new Set(),
      }),
    ).toThrow(/dangling/);
  });

  it('validates exact participant shapes and historical role ownership', () => {
    const runner = buildTestPlayer({ id: 10, teamId: 1, pos: 'rb' });
    const tackler = buildTestPlayer({ id: 20, teamId: 2, pos: 'lb' });
    const drive: DriveRecord = {
      id: 100,
      gameId: 2,
      driveNum: 0,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      result: 'punt',
      points: 0,
      points_needed: 0,
      scoreAAfter: 0,
      scoreBAfter: 0,
    };
    const play: PlayRecord = {
      id: 1001,
      gameId: 2,
      driveId: 100,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      down: 1,
      yardsLeft: 10,
      playType: 'run',
      yardsGained: 4,
      result: 'run',
      text: 'Linked run',
      header: '1st and 10',
      scoreA: 0,
      scoreB: 0,
      call: buildTestPlayCall(),
      participants: buildTestPlayParticipants({
        rusherId: runner.id,
        tacklerId: tackler.id,
      }),
      timing: buildTestPlayTiming(),
    };
    const linkedDetail = buildGameDetail(2, 2025, [drive], [play], []);

    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, tackler],
      historicalPlayers: [],
      playerSeasons: [],
      details: [linkedDetail],
      gameIds: new Set([2]),
    })).not.toThrow();
    expect(isGameDetail({
      ...linkedDetail,
      drives: linkedDetail.drives.map(value => ({
        ...value,
        plays: value.plays.map(linkedPlay => ({
          ...linkedPlay,
          participants: { ...linkedPlay.participants, legacyRunnerId: 10 },
        })),
      })),
    })).toBe(false);
    expect(isGameDetail({
      ...linkedDetail,
      drives: linkedDetail.drives.map(value => ({
        ...value,
        plays: value.plays.map(linkedPlay => ({
          ...linkedPlay,
          call: { ...linkedPlay.call, legacyType: 'run' },
        })),
      })),
    })).toBe(false);

    const invalidCallDetail = structuredClone(linkedDetail);
    invalidCallDetail.drives[0].plays[0].call = {
      kind: 'scrimmage',
      offense: 'deep_pass',
      defense: 'base',
    };
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, tackler],
      historicalPlayers: [],
      playerSeasons: [],
      details: [invalidCallDetail],
      gameIds: new Set([2]),
    })).toThrow(/invalid play call/);

    const invalidDetail = structuredClone(linkedDetail);
    invalidDetail.drives[0].plays[0].participants.rusherId = tackler.id;
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, tackler],
      historicalPlayers: [],
      playerSeasons: [],
      details: [invalidDetail],
      gameIds: new Set([2]),
    })).toThrow(/invalid participant role/);

    invalidDetail.drives[0].plays[0].participants.rusherId = null;
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, tackler],
      historicalPlayers: [],
      playerSeasons: [],
      details: [invalidDetail],
      gameIds: new Set([2]),
    })).toThrow(/incoherent participant roles/);
  });

  it('rejects malformed regulation and overtime timing shapes', () => {
    expect(isPlayTiming(buildTestPlayTiming())).toBe(true);
    const timing = buildTestPlayTiming() as Extract<
      PlayTiming,
      { kind: 'regulation' }
    >;
    const { tempo: _tempo, ...missingTempo } = timing;
    expect(isPlayTiming(missingTempo)).toBe(false);
    expect(isPlayTiming({ ...timing, tempo: 'fast' })).toBe(false);
    expect(isPlayTiming({
      ...timing,
      eventAfter: 'two_minute_timeout',
      chargedTimeoutAfter: 'offense',
    })).toBe(false);
    expect(isPlayTiming({
      ...timing,
      chargedTimeoutAfter: 'defense',
      end: { ...timing.end, running: true },
    })).toBe(false);
    expect(isPlayTiming({
      ...timing,
      legacySeconds: 5,
    })).toBe(false);
    expect(isPlayTiming(buildTestPlayTiming({
      end: { quarter: 1, secondsLeft: 894, running: true },
    }))).toBe(false);
    expect(isPlayTiming({ kind: 'overtime', period: 2, outOfBounds: false })).toBe(true);
    expect(isPlayTiming({ kind: 'overtime', period: 0, outOfBounds: false })).toBe(false);
    expect(isPlayTiming({
      kind: 'try', context: 'regulation', quarter: 4, secondsLeft: 0,
    })).toBe(true);
    expect(isPlayTiming({
      kind: 'try', context: 'overtime', period: 3,
    })).toBe(true);
    expect(isPlayTiming({
      kind: 'try', context: 'regulation', quarter: 5, secondsLeft: 0,
    })).toBe(false);
    expect(isPlayTiming({
      kind: 'try', context: 'overtime', period: 3, outOfBounds: false,
    })).toBe(false);
  });

  it('preserves clock-management calls and timing through game-detail projections', () => {
    const quarterback = buildTestPlayer({ id: 31, teamId: 1, pos: 'qb' });
    const timing = buildTestPlayTiming({
      tempo: 'chew_clock',
      chargedTimeoutAfter: 'defense',
      start: { quarter: 4, secondsLeft: 80, running: true },
      end: { quarter: 4, secondsLeft: 76, running: false },
      elapsedSeconds: 4,
    });
    const drive: DriveRecord = {
      id: 300,
      gameId: 3,
      driveNum: 0,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      result: 'kneel',
      points: 0,
      points_needed: 0,
      scoreAAfter: 21,
      scoreBAfter: 17,
    };
    const play: PlayRecord = {
      id: 3001,
      gameId: 3,
      driveId: 300,
      offenseId: 1,
      defenseId: 2,
      startingFP: 25,
      down: 1,
      yardsLeft: 10,
      playType: 'run',
      yardsGained: -1,
      result: 'kneel',
      text: 'Pat Player took a knee for a loss of 1 yard.',
      header: '1st and 10',
      scoreA: 21,
      scoreB: 17,
      call: { kind: 'clock_management', action: 'kneel' },
      participants: buildTestPlayParticipants({ rusherId: quarterback.id }),
      timing,
    };

    const detail = buildGameDetail(3, 2025, [drive], [play], []);
    const flattened = flattenGameDetail(detail);

    expect(detail.drives[0].plays[0].call).toEqual(play.call);
    expect(detail.drives[0].plays[0].timing).toEqual(timing);
    expect(flattened.plays[0].call).toEqual(play.call);
    expect(flattened.plays[0].timing).toEqual(timing);
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [quarterback],
      historicalPlayers: [],
      playerSeasons: [],
      details: [detail],
      gameIds: new Set([3]),
    })).not.toThrow();
  });

  it('preserves an explicit touchdown try and rejects incoherent try history', () => {
    const runner = buildTestPlayer({ id: 41, teamId: 1, pos: 'rb' });
    const kicker = buildTestPlayer({ id: 42, teamId: 1, pos: 'k' });
    const drive: DriveRecord = {
      id: 400,
      gameId: 4,
      driveNum: 0,
      offenseId: 1,
      defenseId: 2,
      startingFP: 99,
      result: 'touchdown',
      points: 7,
      points_needed: 0,
      scoreAAfter: 7,
      scoreBAfter: 0,
    };
    const touchdown: PlayRecord = {
      id: 4001,
      gameId: 4,
      driveId: 400,
      offenseId: 1,
      defenseId: 2,
      startingFP: 99,
      down: 1,
      yardsLeft: 1,
      playType: 'run',
      yardsGained: 1,
      result: 'touchdown',
      text: 'Pat Player scores.',
      header: '1st and Goal',
      scoreA: 0,
      scoreB: 0,
      call: { kind: 'scrimmage', offense: 'inside_run', defense: 'base' },
      participants: buildTestPlayParticipants({ rusherId: runner.id }),
      timing: buildTestPlayTiming({
        end: { quarter: 1, secondsLeft: 894, running: false },
        elapsedSeconds: 6,
      }),
    };
    const extraPoint: PlayRecord = {
      id: 4002,
      gameId: 4,
      driveId: 400,
      offenseId: 1,
      defenseId: 2,
      startingFP: 97,
      down: 1,
      yardsLeft: 3,
      playType: 'extra point',
      yardsGained: 0,
      result: 'made extra point',
      text: 'Pat Player makes the extra point.',
      header: 'Extra Point',
      scoreA: 6,
      scoreB: 0,
      call: { kind: 'try', attempt: 'extra_point' },
      participants: buildTestPlayParticipants({ kickerId: kicker.id }),
      timing: { kind: 'try', context: 'regulation', quarter: 1, secondsLeft: 894 },
    };
    const detail = buildGameDetail(4, 2025, [drive], [touchdown, extraPoint], []);
    const flattened = flattenGameDetail(detail);

    expect(flattened.plays[1].call).toEqual(extraPoint.call);
    expect(flattened.plays[1].timing).toEqual(extraPoint.timing);
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, kicker],
      historicalPlayers: [],
      playerSeasons: [],
      details: [detail],
      gameIds: new Set([4]),
    })).not.toThrow();

    const missingTry = structuredClone(detail);
    missingTry.drives[0].plays.pop();
    missingTry.drives[0].points = 6;
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, kicker],
      historicalPlayers: [],
      playerSeasons: [],
      details: [missingTry],
      gameIds: new Set([4]),
    })).toThrow(/without a required try/);

    const illegalOvertimeKick = structuredClone(detail);
    illegalOvertimeKick.drives[0].plays[0].timing = {
      kind: 'overtime', period: 2, outOfBounds: false,
    };
    illegalOvertimeKick.drives[0].plays[1].timing = {
      kind: 'try', context: 'overtime', period: 2,
    };
    expect(() => assertHistoricalIntegrity({
      currentPlayers: [runner, kicker],
      historicalPlayers: [],
      playerSeasons: [],
      details: [illegalOvertimeKick],
      gameIds: new Set([4]),
    })).toThrow(/illegal overtime extra point/);
  });
});
