import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRY_FIELD_POSITION } from '../../domain/sim/conversions';
import { hydrateGame } from '../../domain/sim/engine';
import { buildStartersCacheFromPlayers } from '../../domain/sim/statistics';
import {
  createSeededRandom,
  withSeededMathRandom,
} from '../../domain/utils/random';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import type { GameRecord, PlayerRecord } from '../../types/db';
import {
  advanceGameSimSession,
  createGameSimSession,
  type GameSimSession,
} from './gameSimSession';

const buildFixture = () => {
  const teamA = buildTestTeam({
    id: 1,
    name: 'Alpha',
    abbreviation: 'ALP',
  });
  const teamB = buildTestTeam({
    id: 2,
    name: 'Beta',
    abbreviation: 'BET',
    ranking: 2,
  });
  const league = buildTestLeague('season', {
    info: {
      ...buildTestLeague('season').info,
      team: teamA.name,
    },
    teams: [teamA, teamB],
  });
  const record: GameRecord = {
    id: 91,
    teamAId: teamA.id,
    teamBId: teamB.id,
    homeTeamId: null,
    awayTeamId: null,
    neutralSite: true,
    venue: null,
    winnerId: teamB.id,
    baseLabel: 'Alpha vs Beta',
    name: null,
    gameType: 'regular_season',
    rivalryKey: null,
    spreadA: '',
    spreadB: '',
    moneylineA: '',
    moneylineB: '',
    winProbA: 0.5,
    winProbB: 0.5,
    weekPlayed: 1,
    year: 2026,
    rankATOG: 1,
    rankBTOG: 2,
    resultA: 'L',
    resultB: 'W',
    overtime: 2,
    quarter: 4,
    clockSecondsLeft: 0,
    scoreA: 10,
    scoreB: 17,
    watchability: 50,
  };
  let playerId = 1;
  const positions = ['qb', 'rb', 'wr', 'te', 'k', 'p', 'dl', 'lb', 'cb', 's'];
  const players: PlayerRecord[] = [teamA, teamB].flatMap(team =>
    positions.map(pos =>
      buildTestPlayer({
        id: playerId++,
        teamId: team.id,
        first: team.abbreviation,
        last: pos.toUpperCase(),
        pos,
        starter: true,
      }),
    ),
  );
  const teamsById = new Map([
    [teamA.id, teamA],
    [teamB.id, teamB],
  ]);
  return {
    league,
    record,
    teamsById,
    starters: buildStartersCacheFromPlayers(players),
    playersById: new Map(players.map(player => [player.id, player])),
    simGame: hydrateGame(record, teamsById),
    preRecordA: '0-0',
    preRecordB: '0-0',
    isUserGame: true,
  };
};

const advance = (
  session: GameSimSession,
  scope: 'play' | 'drive',
  decision: Parameters<typeof advanceGameSimSession>[1]['decision'] = 'auto',
) =>
  advanceGameSimSession(session, {
    scope,
    decision,
    selectedTempo: 'auto',
    timeoutAfterPlay: false,
  });

const prepareFourthDown = (session: GameSimSession, fieldPosition: number) => {
  const state = session.context.currentDriveState;
  if (!state) throw new Error('Expected an active drive.');
  state.fieldPosition = fieldPosition;
  state.down = 4;
  state.yardsLeft = 1;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('interactive game simulation session', () => {
  it('initializes a clean game and the opening possession', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const session = createGameSimSession(buildFixture());

    expect(session.complete).toBe(false);
    expect(session.driveRecords).toEqual([]);
    expect(session.playRecords).toEqual([]);
    expect(session.context.simGame).toMatchObject({
      scoreA: 0,
      scoreB: 0,
      overtime: 0,
      quarter: 1,
      clockSecondsLeft: 900,
      clockRunning: false,
      timeoutsRemainingA: 3,
      timeoutsRemainingB: 3,
      winner: null,
      resultA: null,
      resultB: null,
    });
    expect(session.context.openingIsTeamA).toBe(true);
    expect(session.context.currentOffense?.id).toBe(1);
    expect(session.context.currentDefense?.id).toBe(2);
    expect(session.context.currentDriveState?.drive).toMatchObject({
      driveNum: 0,
      offenseId: 1,
      defenseId: 2,
    });
  });

  it('publishes one play without duplicating its buffered artifacts', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const session = createGameSimSession(buildFixture());
    const result = advance(session, 'play', {
      kind: 'offense',
      concept: 'inside_run',
    });

    expect(result.plays).toHaveLength(1);
    expect(session.playRecords).toEqual(result.plays);
    expect(session.playRecords[0].driveId).toBe(result.drive.id);
    expect(session.playRecords[0].id).toBe(result.drive.id * 1000 + 1);
    expect(session.driveRecords).toHaveLength(result.driveComplete ? 1 : 0);
  });

  it('matches auto-drive advancement with repeated play advancement', () => {
    const runDrive = (scope: 'play' | 'drive') =>
      withSeededMathRandom(createSeededRandom(2468), () => {
        const session = createGameSimSession(buildFixture());
        if (scope === 'drive') {
          advance(session, 'drive');
        } else {
          while (session.driveRecords.length === 0) {
            advance(session, 'play');
          }
        }
        return {
          drives: structuredClone(session.driveRecords),
          plays: structuredClone(session.playRecords),
        };
      });

    const batched = runDrive('drive');
    const stepped = runDrive('play');
    expect(stepped).toEqual(batched);
    expect(batched.drives).toHaveLength(1);
    expect(batched.plays.map(play => play.id)).toEqual(
      [...batched.plays]
        .sort((left, right) => left.id - right.id)
        .map(play => play.id),
    );
    expect(new Set(batched.plays.map(play => play.id)).size).toBe(
      batched.plays.length,
    );
  });

  it('gives the second-half opening possession to the first-half receiver', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const session = createGameSimSession(buildFixture());
    session.context.simGame.quarter = 2;
    session.context.simGame.clockSecondsLeft = 1;
    session.context.driveStartQuarter = 2;

    const result = advance(session, 'play', {
      kind: 'offense',
      concept: 'inside_run',
    });

    expect(result.driveComplete).toBe(true);
    expect(result.drive.result).toBe('end of half');
    expect(session.context.simGame.quarter).toBe(3);
    expect(session.context.currentOffense?.id).toBe(2);
    expect(session.context.nextOffenseIsTeamA).toBe(false);
  });

  it('finalizes one terminal regulation session without duplicate records', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const session = createGameSimSession(buildFixture());
    session.context.simGame.quarter = 4;
    session.context.simGame.clockSecondsLeft = 1;
    session.context.simGame.scoreA = 7;
    session.context.simGame.scoreB = 0;
    session.context.driveStartQuarter = 4;

    const result = advance(session, 'play', {
      kind: 'offense',
      concept: 'inside_run',
    });

    expect(result).toMatchObject({
      driveComplete: true,
      gameComplete: true,
    });
    expect(session.complete).toBe(true);
    expect(session.context.simGame.winner?.id).toBe(1);
    expect(session.driveRecords).toHaveLength(1);
    expect(session.playRecords).toHaveLength(1);
    expect(() => advance(session, 'play')).toThrow(
      'The game simulation is already complete.',
    );
    expect(session.driveRecords).toHaveLength(1);
    expect(session.playRecords).toHaveLength(1);
  });

  it('runs paired overtime possessions before opening the next round', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const session = createGameSimSession(buildFixture());
    session.context.inOvertime = true;
    session.context.otPossession = 0;
    session.context.simGame.overtime = 1;
    session.context.simGame.scoreA = 0;
    session.context.simGame.scoreB = 0;
    prepareFourthDown(session, 75);

    const first = advance(session, 'play', {
      kind: 'special_teams',
      concept: 'field_goal',
    });
    expect(first.gameComplete).toBe(false);
    expect(session.context.otPossession).toBe(1);
    expect(session.context.currentOffense?.id).toBe(2);
    expect(session.context.simGame.scoreA).toBe(3);

    prepareFourthDown(session, 75);
    const second = advance(session, 'play', {
      kind: 'special_teams',
      concept: 'field_goal',
    });
    expect(second.gameComplete).toBe(false);
    expect(session.context.simGame.scoreB).toBe(3);
    expect(session.context.simGame.overtime).toBe(2);
    expect(session.context.otPossession).toBe(0);
    expect(session.context.currentOffense?.id).toBe(1);
  });

  it('starts third overtime as paired two-point shootout tries', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const session = createGameSimSession(buildFixture());
    session.context.inOvertime = true;
    session.context.otPossession = 1;
    session.context.simGame.overtime = 2;
    session.context.simGame.scoreA = 0;
    session.context.simGame.scoreB = 0;
    session.context.currentOffense = session.context.simGame.teamB;
    session.context.currentDefense = session.context.simGame.teamA;
    prepareFourthDown(session, 75);

    const result = advance(session, 'play', {
      kind: 'special_teams',
      concept: 'field_goal',
    });

    expect(result.gameComplete).toBe(false);
    expect(session.context.simGame.overtime).toBe(3);
    expect(session.context.otPossession).toBe(0);
    expect(session.context.currentOffense?.id).toBe(1);
    expect(session.context.currentDriveState).toMatchObject({
      phase: 'try',
      tryOrigin: 'overtime_shootout',
      fieldPosition: TRY_FIELD_POSITION,
      down: 1,
    });
  });
});
