import { describe, expect, it, vi } from 'vitest';
import {
  buildTestLeague,
  buildTestPlayParticipants,
  buildTestPlayer,
  buildTestTeam,
} from '../test/fixtures';
import type { GameDetailRecord, GameRecord } from '../types/db';
import {
  assertCurrentGameDetailRecord,
  assertCurrentGameDetailRecords,
  assertGameDetailReferences,
} from './gameDetailValidation';
import { buildGameDetail } from '../domain/league/gameDetails';
import { hydrateGame, simGame } from '../domain/sim/engine';
import {
  buildStartersCacheFromPlayers,
  createGameLogsFromPlays,
} from '../domain/sim/statistics';

const zeroStats = (playerId: number) => ({
  playerId,
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
});

const completedGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: 'Alpha vs Beta',
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
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 6,
  scoreB: 0,
  watchability: 70,
  ...overrides,
});

const regulationDetail = (): GameDetailRecord => ({
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
      text: 'Runner scored on an inside run.',
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
  playerStats: [{ ...zeroStats(10), rush_attempts: 1, rush_yards: 6, rush_touchdowns: 1 }],
});

const overtimeDetail = (): GameDetailRecord => ({
  gameId: 1,
  year: 2026,
  drives: [
    {
      driveNum: 1,
      offenseId: 1,
      defenseId: 2,
      startingFP: 97,
      result: 'made two point run',
      points: 2,
      scoreAAfter: 2,
      scoreBAfter: 0,
      plays: [{
        startingFP: 97,
        down: 1,
        yardsLeft: 3,
        playType: 'run',
        yardsGained: 3,
        result: 'made two point run',
        text: 'Alpha converted the two-point try.',
        header: 'Two-Point Try',
        scoreA: 0,
        scoreB: 0,
        call: {
          kind: 'try',
          attempt: 'two_point',
          offense: 'inside_run',
          defense: 'base',
        },
        participants: buildTestPlayParticipants({ rusherId: 10 }),
        timing: { kind: 'try', context: 'overtime', period: 3 },
      }],
    },
    {
      driveNum: 2,
      offenseId: 2,
      defenseId: 1,
      startingFP: 97,
      result: 'failed two point run',
      points: 0,
      scoreAAfter: 2,
      scoreBAfter: 0,
      plays: [{
        startingFP: 97,
        down: 1,
        yardsLeft: 3,
        playType: 'run',
        yardsGained: 1,
        result: 'failed two point run',
        text: 'Beta was stopped on the two-point try.',
        header: 'Two-Point Try',
        scoreA: 2,
        scoreB: 0,
        call: {
          kind: 'try',
          attempt: 'two_point',
          offense: 'inside_run',
          defense: 'base',
        },
        participants: buildTestPlayParticipants({ rusherId: 20, tacklerId: 11 }),
        timing: { kind: 'try', context: 'overtime', period: 3 },
      }],
    },
  ],
  playerStats: [zeroStats(10), zeroStats(11), zeroStats(20)],
});

const players = [
  buildTestPlayer({ id: 10, teamId: 1, pos: 'rb', starter: true }),
  buildTestPlayer({ id: 11, teamId: 1, pos: 'lb', starter: true }),
  buildTestPlayer({ id: 20, teamId: 2, pos: 'rb', starter: true }),
];

describe('current game-detail validation', () => {
  it('accepts exact regulation and overtime details with current references', () => {
    expect(() => assertGameDetailReferences({
      details: [regulationDetail()],
      games: [completedGame()],
      currentPlayers: players,
    })).not.toThrow();
    expect(() => assertGameDetailReferences({
      details: [overtimeDetail()],
      games: [completedGame({ overtime: 3, scoreA: 2 })],
      currentPlayers: players,
    })).not.toThrow();
  });

  it('accepts a complete detail emitted by the production simulation path', () => {
    const teamA = buildTestTeam({ id: 1, name: 'Alpha' });
    const teamB = buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET' });
    const base = buildTestLeague('season');
    const league = buildTestLeague('season', {
      teams: [teamA, teamB],
      conferences: [{ ...base.conferences[0], teams: [teamA, teamB] }],
      idCounters: { game: 2, player: 1000 },
    });
    const positions = ['qb', 'rb', 'wr', 'te', 'k', 'p', 'dl', 'lb', 'cb', 's'];
    const roster = [teamA, teamB].flatMap((team, teamIndex) =>
      positions.map((pos, index) => buildTestPlayer({
        id: teamIndex * 100 + index + 1,
        teamId: team.id,
        pos,
        starter: true,
      })),
    );
    const starters = buildStartersCacheFromPlayers(roster);
    const upcoming = completedGame({
      winnerId: null,
      resultA: null,
      resultB: null,
      overtime: 0,
      quarter: 1,
      clockSecondsLeft: 900,
      scoreA: null,
      scoreB: null,
    });
    const simulated = hydrateGame(upcoming, new Map([[1, teamA], [2, teamB]]));
    let randomState = 0x9e3779b9;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x1_0000_0000;
    });
    try {
      const drives = simGame(league, simulated, starters);
      const driveRecords = drives.map(drive => drive.record);
      const plays = drives.flatMap(drive => drive.plays);
      const logs = createGameLogsFromPlays(simulated, plays, starters);
      const detail = buildGameDetail(1, 2026, driveRecords, plays, logs);
      const game = completedGame({
        winnerId: simulated.winner!.id,
        resultA: simulated.resultA,
        resultB: simulated.resultB,
        overtime: simulated.overtime,
        scoreA: simulated.scoreA,
        scoreB: simulated.scoreB,
      });
      expect(() => assertGameDetailReferences({
        details: [detail],
        games: [game],
        currentPlayers: roster,
      })).not.toThrow();
    } finally {
      random.mockRestore();
    }
  });

  it('rejects missing, unknown, unfinished, and malformed nested fields', () => {
    const { year: _year, ...missing } = regulationDetail();
    expect(() => assertCurrentGameDetailRecord(missing)).toThrowError(
      expect.objectContaining({ code: 'INVALID_GAME_DETAIL_RECORD' }),
    );
    expect(() => assertCurrentGameDetailRecord({
      ...regulationDetail(),
      legacyDrives: [],
    })).toThrowError(expect.objectContaining({ code: 'INVALID_GAME_DETAIL_RECORD' }));

    const nestedKeyMutations: Array<(detail: GameDetailRecord) => void> = [
      detail => { (detail.drives[0] as unknown as Record<string, unknown>).legacy = true; },
      detail => { delete (detail.drives[0] as unknown as Record<string, unknown>).points; },
      detail => { (detail.drives[0].plays[0] as unknown as Record<string, unknown>).legacy = true; },
      detail => { delete (detail.drives[0].plays[0] as unknown as Record<string, unknown>).header; },
      detail => { (detail.drives[0].plays[0].call as unknown as Record<string, unknown>).legacy = true; },
      detail => { delete (detail.drives[0].plays[0].call as unknown as Record<string, unknown>).defense; },
      detail => {
        (detail.drives[0].plays[0].participants as unknown as Record<string, unknown>).legacy = null;
      },
      detail => {
        delete (detail.drives[0].plays[0].participants as unknown as Record<string, unknown>).rusherId;
      },
      detail => { (detail.drives[0].plays[0].timing as unknown as Record<string, unknown>).legacy = 0; },
      detail => {
        const timing = detail.drives[0].plays[0].timing;
        if (timing.kind !== 'regulation') throw new Error('Expected regulation timing.');
        delete (timing.start as unknown as Record<string, unknown>).running;
      },
      detail => { (detail.playerStats[0] as unknown as Record<string, unknown>).legacy = 0; },
      detail => { delete (detail.playerStats[0] as unknown as Record<string, unknown>).tackles; },
    ];
    for (const mutate of nestedKeyMutations) {
      const detail = structuredClone(regulationDetail());
      mutate(detail);
      expect(() => assertCurrentGameDetailRecord(detail)).toThrowError(
        expect.objectContaining({ code: 'INVALID_GAME_DETAIL_RECORD' }),
      );
    }

    for (const mutate of [
      (detail: GameDetailRecord) => Object.assign(detail.drives[0], { result: '' }),
      (detail: GameDetailRecord) => Object.assign(detail.drives[0].plays[0], { result: '' }),
      (detail: GameDetailRecord) => Object.assign(detail.drives[0].plays[0], { playType: 'legacy' }),
      (detail: GameDetailRecord) => Object.assign(detail.drives[0].plays[0], { down: 5 }),
      (detail: GameDetailRecord) => Object.assign(detail.playerStats[0], { tackles: Number.NaN }),
      (detail: GameDetailRecord) => Object.assign(
        detail.drives[0].plays[0].participants,
        { rusherId: 0 },
      ),
    ]) {
      const detail = structuredClone(regulationDetail());
      mutate(detail);
      expect(() => assertCurrentGameDetailRecord(detail)).toThrowError(
        expect.objectContaining({ code: 'INVALID_GAME_DETAIL_RECORD' }),
      );
    }
  });

  it('rejects malformed calls, timing, participant roles, and conversion history', () => {
    const invalidCall = structuredClone(regulationDetail());
    invalidCall.drives[0].plays[0].call = {
      kind: 'scrimmage',
      offense: 'deep_pass',
      defense: 'base',
    };
    expect(() => assertCurrentGameDetailRecord(invalidCall)).toThrow(/invalid play call/);

    const invalidTiming = structuredClone(regulationDetail());
    const timing = invalidTiming.drives[0].plays[0].timing;
    if (timing.kind !== 'regulation') throw new Error('Expected regulation timing.');
    timing.elapsedSeconds = 5;
    expect(() => assertCurrentGameDetailRecord(invalidTiming)).toThrowError(
      expect.objectContaining({ code: 'INVALID_GAME_DETAIL_RECORD' }),
    );

    const missingRole = structuredClone(regulationDetail());
    missingRole.drives[0].plays[0].participants.rusherId = null;
    expect(() => assertCurrentGameDetailRecord(missingRole)).toThrow(/participant roles/);

    const unpairedOvertime = structuredClone(overtimeDetail());
    unpairedOvertime.drives.pop();
    expect(() => assertCurrentGameDetailRecord(unpairedOvertime)).toThrow(/unpaired overtime/);
  });

  it('enforces clock management, timeout limits, and overtime conversion rules', () => {
    const invalidKneel = structuredClone(regulationDetail());
    const kneelDrive = invalidKneel.drives[0];
    const kneel = kneelDrive.plays[0];
    kneelDrive.result = 'end of game';
    kneelDrive.points = 0;
    kneelDrive.scoreAAfter = 0;
    kneel.call = { kind: 'clock_management', action: 'kneel' };
    kneel.result = 'kneel';
    kneel.yardsGained = -1;
    expect(() => assertCurrentGameDetailRecord(invalidKneel)).toThrow(/clock management/);

    const illegalExtraPoint = structuredClone(regulationDetail());
    const overtimeDrive = illegalExtraPoint.drives[0];
    overtimeDrive.points = 7;
    overtimeDrive.scoreAAfter = 7;
    overtimeDrive.plays[0].timing = {
      kind: 'overtime', period: 2, outOfBounds: false,
    };
    overtimeDrive.plays.push({
      startingFP: 97,
      down: 1,
      yardsLeft: 3,
      playType: 'extra point',
      yardsGained: 0,
      result: 'made extra point',
      text: 'The extra point was good.',
      header: 'Extra Point',
      scoreA: 6,
      scoreB: 0,
      call: { kind: 'try', attempt: 'extra_point' },
      participants: buildTestPlayParticipants({ kickerId: 12 }),
      timing: { kind: 'try', context: 'overtime', period: 2 },
    });
    expect(() => assertCurrentGameDetailRecord(illegalExtraPoint))
      .toThrow(/illegal overtime extra point/);

    const excessiveTimeouts = structuredClone(regulationDetail());
    const timeoutDrive = excessiveTimeouts.drives[0];
    timeoutDrive.startingFP = 25;
    timeoutDrive.plays = Array.from({ length: 4 }, (_, index) => ({
      startingFP: 25 + index,
      down: 1,
      yardsLeft: 10,
      playType: 'run' as const,
      yardsGained: 1,
      result: 'run' as const,
      text: 'Runner gained one yard.',
      header: '1st and 10',
      scoreA: 0,
      scoreB: 0,
      call: { kind: 'scrimmage' as const, offense: 'inside_run' as const, defense: 'base' as const },
      participants: buildTestPlayParticipants({ rusherId: 10, tacklerId: 11 }),
      timing: {
        kind: 'regulation' as const,
        start: { quarter: 4 as const, secondsLeft: 100 - index * 5, running: index === 0 },
        end: { quarter: 4 as const, secondsLeft: 95 - index * 5, running: false },
        elapsedSeconds: 5,
        outOfBounds: false,
        tempo: 'normal' as const,
        eventAfter: null,
        chargedTimeoutAfter: 'defense' as const,
      },
    }));
    timeoutDrive.plays.push({
      ...regulationDetail().drives[0].plays[0],
      startingFP: 94,
      timing: {
        kind: 'regulation',
        start: { quarter: 4, secondsLeft: 80, running: false },
        end: { quarter: 4, secondsLeft: 0, running: false },
        elapsedSeconds: 80,
        outOfBounds: false,
        tempo: 'normal',
        eventAfter: 'end_of_regulation',
        chargedTimeoutAfter: null,
      },
    });
    expect(() => assertCurrentGameDetailRecord(excessiveTimeouts))
      .toThrow(/timeout limits/);
  });

  it('rejects duplicate identities and invalid game, team, player, and score references', () => {
    expect(() => assertCurrentGameDetailRecords([
      regulationDetail(),
      regulationDetail(),
    ])).toThrow(/duplicate game IDs/);

    const duplicateLog = structuredClone(regulationDetail());
    duplicateLog.playerStats.push(structuredClone(duplicateLog.playerStats[0]));
    expect(() => assertCurrentGameDetailRecord(duplicateLog)).toThrow(/duplicate player ID/);

    const wrongTeam = structuredClone(regulationDetail());
    wrongTeam.drives[0].offenseId = 3;
    expect(() => assertGameDetailReferences({
      details: [wrongTeam], games: [completedGame()], currentPlayers: players,
    })).toThrow(/team reference/);

    expect(() => assertGameDetailReferences({
      details: [regulationDetail()],
      games: [completedGame({ year: 2025 })],
      currentPlayers: players,
    })).toThrow(/matching completed game/);
    expect(() => assertGameDetailReferences({
      details: [regulationDetail()], games: [completedGame()], currentPlayers: [],
    })).toThrow(/dangling participant/);
    expect(() => assertGameDetailReferences({
      details: [regulationDetail()],
      games: [completedGame({ scoreA: 7 })],
      currentPlayers: players,
    })).toThrow(/final game score/);
  });
});
