import type {
  DriveResult,
  GameDetailRecord,
  GameRecord,
  HistoricalPlayerRecord,
  PlayResult,
  PlayTiming,
  PlayerRecord,
  PlayerSeasonStats,
  PlayType,
} from '../types/db';
import { PLAYER_SEASON_STAT_KEYS } from '../domain/league/gameDetails';
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_RULES,
  participantPositionsForPlay,
  requiredParticipantRoles,
} from '../domain/sim/participantRules';
import { isPlayCall, validatePlayCall } from '../domain/sim/concepts';
import { tryResultMatchesCall, twoPointSucceeded } from '../domain/sim/conversions';
import { GameDataIntegrityError } from './gameDataIntegrityError';

const DETAIL_KEYS = ['gameId', 'year', 'drives', 'playerStats'] as const;
const DRIVE_KEYS = [
  'driveNum',
  'offenseId',
  'defenseId',
  'startingFP',
  'result',
  'points',
  'scoreAAfter',
  'scoreBAfter',
  'plays',
] as const;
const PLAY_KEYS = [
  'startingFP',
  'down',
  'yardsLeft',
  'playType',
  'yardsGained',
  'result',
  'text',
  'header',
  'scoreA',
  'scoreB',
  'call',
  'participants',
  'timing',
] as const;
const LOG_KEYS = ['playerId', ...PLAYER_SEASON_STAT_KEYS] as const;
const PLAY_TYPES: readonly PlayType[] = [
  'run',
  'pass',
  'field goal',
  'punt',
  'extra point',
];
const PLAY_RESULTS: readonly PlayResult[] = [
  'run',
  'pass',
  'sack',
  'interception',
  'incomplete pass',
  'fumble',
  'touchdown',
  'made field goal',
  'missed field goal',
  'punt',
  'spike',
  'kneel',
  'made extra point',
  'missed extra point',
  'made two point run',
  'made two point pass',
  'failed two point run',
  'failed two point pass',
  'failed two point incomplete',
  'failed two point sack',
  'failed two point interception',
  'failed two point fumble',
];
const DRIVE_RESULTS: readonly DriveResult[] = [
  'touchdown',
  'interception',
  'fumble',
  'safety',
  'turnover on downs',
  'made field goal',
  'missed field goal',
  'punt',
  'end of half',
  'end of game',
  'made two point run',
  'made two point pass',
  'failed two point run',
  'failed two point pass',
  'failed two point incomplete',
  'failed two point sack',
  'failed two point interception',
  'failed two point fumble',
];
const CLOCK_EVENTS = [
  'two_minute_timeout',
  'end_of_quarter',
  'halftime',
  'end_of_regulation',
] as const;
const SIGNED_STAT_KEYS = new Set<string>([
  'pass_yards',
  'rush_yards',
  'receiving_yards',
]);

function fail(message: string): never {
  throw new GameDataIntegrityError('INVALID_GAME_DETAIL_RECORD', message);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const isNonnegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

const isInteger = (value: unknown): value is number => Number.isInteger(value);

const isNonemptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isClockSnapshot = (value: unknown) => isRecord(value)
  && hasExactKeys(value, ['quarter', 'secondsLeft', 'running'])
  && Number.isInteger(value.quarter)
  && Number(value.quarter) >= 1
  && Number(value.quarter) <= 4
  && Number.isInteger(value.secondsLeft)
  && Number(value.secondsLeft) >= 0
  && Number(value.secondsLeft) <= 900
  && typeof value.running === 'boolean';

const isPlayTiming = (value: unknown): value is PlayTiming => {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'overtime') {
    return hasExactKeys(value, ['kind', 'period', 'outOfBounds'])
      && isPositiveInteger(value.period)
      && typeof value.outOfBounds === 'boolean';
  }
  if (value.kind === 'try') {
    if (value.context === 'regulation') {
      return hasExactKeys(value, ['kind', 'context', 'quarter', 'secondsLeft'])
        && Number.isInteger(value.quarter)
        && Number(value.quarter) >= 1
        && Number(value.quarter) <= 4
        && Number.isInteger(value.secondsLeft)
        && Number(value.secondsLeft) >= 0
        && Number(value.secondsLeft) <= 900;
    }
    return value.context === 'overtime'
      && hasExactKeys(value, ['kind', 'context', 'period'])
      && isPositiveInteger(value.period);
  }
  if (
    value.kind !== 'regulation'
    || !hasExactKeys(value, [
      'kind',
      'start',
      'end',
      'elapsedSeconds',
      'outOfBounds',
      'tempo',
      'eventAfter',
      'chargedTimeoutAfter',
    ])
    || !isClockSnapshot(value.start)
    || !isClockSnapshot(value.end)
    || !isNonnegativeInteger(value.elapsedSeconds)
    || typeof value.outOfBounds !== 'boolean'
    || !['normal', 'hurry_up', 'chew_clock'].includes(String(value.tempo))
    || !(value.eventAfter === null
      || CLOCK_EVENTS.includes(value.eventAfter as typeof CLOCK_EVENTS[number]))
    || !(value.chargedTimeoutAfter === null
      || value.chargedTimeoutAfter === 'offense'
      || value.chargedTimeoutAfter === 'defense')
    || (value.eventAfter !== null && value.chargedTimeoutAfter !== null)
  ) return false;
  const start = value.start as Record<string, unknown>;
  const end = value.end as Record<string, unknown>;
  if (
    start.quarter !== end.quarter
    || Number(start.secondsLeft) - Number(end.secondsLeft) !== value.elapsedSeconds
  ) return false;
  if ((value.eventAfter !== null || value.chargedTimeoutAfter !== null)
    && end.running !== false) return false;
  if (value.eventAfter === 'two_minute_timeout') {
    return (end.quarter === 2 || end.quarter === 4)
      && Number(end.secondsLeft) <= 120
      && Number(end.secondsLeft) > 0;
  }
  if (value.eventAfter === 'end_of_quarter') {
    return (end.quarter === 1 || end.quarter === 3) && end.secondsLeft === 0;
  }
  if (value.eventAfter === 'halftime') return end.quarter === 2 && end.secondsLeft === 0;
  if (value.eventAfter === 'end_of_regulation') {
    return end.quarter === 4 && end.secondsLeft === 0;
  }
  return Number(end.secondsLeft) > 0;
};

const isPlayParticipants = (value: unknown) => isRecord(value)
  && hasExactKeys(value, PARTICIPANT_ROLES)
  && PARTICIPANT_ROLES.every(role =>
    value[role] === null || isPositiveInteger(value[role]),
  );

const playResultMatchesCall = (play: GameDetailRecord['drives'][number]['plays'][number]) => {
  if (play.call.kind === 'clock_management') return play.result === play.call.action;
  if (play.call.kind === 'try') return tryResultMatchesCall(play.call, play.result);
  if (play.call.kind === 'special_teams') {
    return play.call.concept === 'punt'
      ? play.result === 'punt'
      : play.result === 'made field goal' || play.result === 'missed field goal';
  }
  if (play.playType === 'run') {
    return play.result === 'run'
      || play.result === 'fumble'
      || play.result === 'touchdown';
  }
  return play.playType === 'pass' && (
    play.result === 'pass'
    || play.result === 'sack'
    || play.result === 'interception'
    || play.result === 'incomplete pass'
    || play.result === 'touchdown'
  );
};

const driveResultMatchesFinalPlay = (
  drive: GameDetailRecord['drives'][number],
) => {
  const play = drive.plays[drive.plays.length - 1];
  if (drive.result === 'touchdown') return play.result === 'touchdown'
    || play.call.kind === 'try';
  if (drive.result === 'made field goal' || drive.result === 'missed field goal'
    || drive.result === 'punt' || drive.result === 'interception'
    || drive.result === 'fumble') return play.result === drive.result;
  if (drive.result === 'safety') {
    return play.startingFP + play.yardsGained < 1;
  }
  if (drive.result === 'turnover on downs') {
    return play.down === 4 && play.yardsGained < play.yardsLeft;
  }
  if (drive.result === 'end of half' || drive.result === 'end of game') {
    return play.timing.kind === 'regulation'
      && play.timing.end.secondsLeft === 0;
  }
  return play.call.kind === 'try' && play.result === drive.result;
};

function assertDetailShape(value: unknown): asserts value is GameDetailRecord {
  if (!isRecord(value) || !hasExactKeys(value, DETAIL_KEYS)) {
    fail('Saved game detail has missing or unknown fields.');
  }
  const detail = value as Record<string, unknown>;
  if (
    !isPositiveInteger(detail.gameId)
    || !isPositiveInteger(detail.year)
    || !Array.isArray(detail.drives)
    || detail.drives.length === 0
    || !Array.isArray(detail.playerStats)
    || detail.playerStats.length === 0
  ) fail('Saved game detail contains an invalid top-level value.');

  let previousDriveNum = -1;
  for (const rawDrive of detail.drives as unknown[]) {
    if (!isRecord(rawDrive) || !hasExactKeys(rawDrive, DRIVE_KEYS)) {
      fail('Saved game detail drive has missing or unknown fields.');
    }
    if (
      !isNonnegativeInteger(rawDrive.driveNum)
      || Number(rawDrive.driveNum) <= previousDriveNum
      || !isPositiveInteger(rawDrive.offenseId)
      || !isPositiveInteger(rawDrive.defenseId)
      || rawDrive.offenseId === rawDrive.defenseId
      || !Number.isInteger(rawDrive.startingFP)
      || Number(rawDrive.startingFP) < 1
      || Number(rawDrive.startingFP) > 99
      || !DRIVE_RESULTS.includes(rawDrive.result as DriveResult)
      || !isNonnegativeInteger(rawDrive.points)
      || Number(rawDrive.points) > 8
      || !isNonnegativeInteger(rawDrive.scoreAAfter)
      || !isNonnegativeInteger(rawDrive.scoreBAfter)
      || !Array.isArray(rawDrive.plays)
      || rawDrive.plays.length === 0
    ) fail('Saved game detail drive contains an invalid field value.');
    previousDriveNum = Number(rawDrive.driveNum);

    for (const rawPlay of rawDrive.plays as unknown[]) {
      if (!isRecord(rawPlay) || !hasExactKeys(rawPlay, PLAY_KEYS)) {
        fail('Saved game detail play has missing or unknown fields.');
      }
      if (
        !Number.isInteger(rawPlay.startingFP)
        || Number(rawPlay.startingFP) < 1
        || Number(rawPlay.startingFP) > 99
        || !Number.isInteger(rawPlay.down)
        || Number(rawPlay.down) < 1
        || Number(rawPlay.down) > 4
        || !isPositiveInteger(rawPlay.yardsLeft)
        || Number(rawPlay.yardsLeft) > 99
        || !PLAY_TYPES.includes(rawPlay.playType as PlayType)
        || !isInteger(rawPlay.yardsGained)
        || !PLAY_RESULTS.includes(rawPlay.result as PlayResult)
        || !isNonemptyString(rawPlay.text)
        || !isNonemptyString(rawPlay.header)
        || !isNonnegativeInteger(rawPlay.scoreA)
        || !isNonnegativeInteger(rawPlay.scoreB)
        || !isPlayCall(rawPlay.call)
        || !isPlayParticipants(rawPlay.participants)
        || !isPlayTiming(rawPlay.timing)
      ) fail('Saved game detail play contains an invalid field value.');
    }
  }

  const playerIds = new Set<number>();
  for (const rawLog of detail.playerStats as unknown[]) {
    if (!isRecord(rawLog) || !hasExactKeys(rawLog, LOG_KEYS)) {
      fail('Saved player-game row has missing or unknown fields.');
    }
    if (!isPositiveInteger(rawLog.playerId) || playerIds.has(rawLog.playerId)) {
      fail('Saved player-game rows contain an invalid or duplicate player ID.');
    }
    playerIds.add(rawLog.playerId);
    for (const key of PLAYER_SEASON_STAT_KEYS) {
      if (!isInteger(rawLog[key]) || (!SIGNED_STAT_KEYS.has(key) && Number(rawLog[key]) < 0)) {
        fail('Saved player-game row contains an invalid statistic.');
      }
    }
  }
}

const assertDetailSemantics = (detail: GameDetailRecord) => {
  let previousTiming: PlayTiming | null = null;
  let previousRegulation: Extract<PlayTiming, { kind: 'regulation' }> | null = null;
  let overtimeStarted = false;
  const timeoutUses = new Map<string, number>();
  const overtimePossessions = new Map<number, number>();

  for (const drive of detail.drives) {
    const firstPlay = drive.plays[0];
    if (firstPlay.startingFP !== drive.startingFP || !driveResultMatchesFinalPlay(drive)) {
      fail('Saved game detail has an incoherent drive ending.');
    }
    const overtimePeriod = firstPlay.timing.kind === 'overtime'
      ? firstPlay.timing.period
      : firstPlay.timing.kind === 'try' && firstPlay.timing.context === 'overtime'
        ? firstPlay.timing.period
        : null;
    const overtimePossession = overtimePeriod === null
      ? null
      : overtimePossessions.get(overtimePeriod) ?? 0;
    if (overtimePeriod !== null) {
      overtimePossessions.set(overtimePeriod, overtimePossession! + 1);
    }

    const touchdownIndex = drive.plays.findIndex(play => play.result === 'touchdown');
    const tryIndex = drive.plays.findIndex(play => play.call.kind === 'try');
    if (touchdownIndex >= 0) {
      const touchdown = drive.plays[touchdownIndex];
      const tryPlay = tryIndex >= 0 ? drive.plays[tryIndex] : null;
      if (tryPlay && (tryIndex !== touchdownIndex + 1 || tryIndex !== drive.plays.length - 1)) {
        fail('Saved game detail has a try outside the end of its touchdown drive.');
      }
      if (!tryPlay) {
        const terminalRegulation = touchdown.timing.kind === 'regulation'
          && touchdown.timing.end.quarter === 4
          && touchdown.timing.end.secondsLeft === 0;
        const terminalOvertime = overtimePeriod !== null && overtimePossession === 1;
        if (!terminalRegulation && !terminalOvertime) {
          fail('Saved game detail has a touchdown without a required try.');
        }
      }
      const expectedPoints = !tryPlay || tryPlay.call.kind !== 'try'
        ? 6
        : tryPlay.call.attempt === 'extra_point'
          ? tryPlay.result === 'made extra point' ? 7 : 6
          : twoPointSucceeded(tryPlay.result) ? 8 : 6;
      if (drive.points !== expectedPoints || drive.result !== 'touchdown') {
        fail('Saved game detail has incoherent touchdown-drive scoring.');
      }
    } else if (tryIndex >= 0) {
      const tryPlay = drive.plays[tryIndex];
      if (tryPlay.call.kind !== 'try') {
        fail('Saved game detail has an incoherent try call.');
      }
      const shootout = overtimePeriod !== null
        && overtimePeriod >= 3
        && drive.plays.length === 1
        && tryPlay.call.kind === 'try'
        && tryPlay.call.attempt === 'two_point';
      if (!shootout) fail('Saved game detail has a try without a touchdown.');
      const expectedPoints = twoPointSucceeded(tryPlay.result) ? 2 : 0;
      if (drive.points !== expectedPoints || drive.result !== tryPlay.result) {
        fail('Saved game detail has incoherent overtime-try scoring.');
      }
    }
    if (overtimePeriod !== null && overtimePeriod >= 3 && !(
      drive.plays.length === 1
      && firstPlay.call.kind === 'try'
      && firstPlay.call.attempt === 'two_point'
    )) fail('Saved game detail has an invalid third-or-later overtime possession.');

    let previousPlayInDrive: (typeof drive.plays)[number] | null = null;
    for (const play of drive.plays) {
      if (validatePlayCall(play.call, play.down, play.playType).length) {
        fail('Saved game detail has an invalid play call.');
      }
      if (!playResultMatchesCall(play)) {
        fail('Saved game detail has a result that disagrees with its play call.');
      }
      if ((play.call.kind === 'try') !== (play.timing.kind === 'try')) {
        fail('Saved game detail has incoherent try call and timing.');
      }
      if (play.timing.kind !== 'try' && play.timing.outOfBounds && !(
        (play.playType === 'run' && play.result === 'run')
        || (play.playType === 'pass' && play.result === 'pass')
      )) fail('Saved game detail has incoherent out-of-bounds timing.');

      if (play.timing.kind === 'overtime') {
        if (play.call.kind === 'clock_management') {
          fail('Saved game detail manages an overtime clock.');
        }
        if (!overtimeStarted && previousRegulation
          && previousRegulation.eventAfter !== 'end_of_regulation') {
          fail('Saved game detail enters overtime before regulation ends.');
        }
        overtimeStarted = true;
      } else if (play.timing.kind === 'regulation') {
        if (overtimeStarted) fail('Saved game detail returns to regulation after overtime begins.');
        if (previousRegulation) {
          const expected = previousRegulation.eventAfter === 'end_of_quarter'
            || previousRegulation.eventAfter === 'halftime'
            ? {
                quarter: previousRegulation.end.quarter + 1,
                secondsLeft: 900,
                running: false,
              }
            : previousRegulation.end;
          if (
            play.timing.start.quarter !== expected.quarter
            || play.timing.start.secondsLeft !== expected.secondsLeft
            || play.timing.start.running !== expected.running
          ) fail('Saved game detail has an incoherent timing chain.');
        }
        if (play.timing.chargedTimeoutAfter) {
          const teamId = play.timing.chargedTimeoutAfter === 'offense'
            ? drive.offenseId
            : drive.defenseId;
          const half = play.timing.start.quarter <= 2 ? 1 : 2;
          const key = `${half}:${teamId}`;
          const uses = (timeoutUses.get(key) ?? 0) + 1;
          timeoutUses.set(key, uses);
          if (uses > 3) fail('Saved game detail exceeds charged timeout limits.');
          const terminal = [
            'incomplete pass',
            'interception',
            'fumble',
            'touchdown',
            'made field goal',
            'missed field goal',
            'punt',
            'spike',
          ].includes(play.result)
            || play.startingFP + play.yardsGained < 1
            || (play.down === 4 && play.yardsGained < play.yardsLeft);
          const firstDownStop = play.yardsGained >= play.yardsLeft
            && (play.timing.end.quarter === 2 || play.timing.end.quarter === 4)
            && play.timing.end.secondsLeft <= 120;
          const outOfBoundsStop = play.timing.outOfBounds && (
            (play.timing.end.quarter === 2 && play.timing.end.secondsLeft <= 120)
            || (play.timing.end.quarter === 4 && play.timing.end.secondsLeft <= 300)
          );
          if (terminal || firstDownStop || outOfBoundsStop) {
            fail('Saved game detail charges a timeout after a stopped-clock play.');
          }
        }
        if (play.call.kind === 'clock_management') {
          const validSpike = play.call.action === 'spike'
            && play.playType === 'pass'
            && play.result === 'spike'
            && play.yardsGained === 0
            && play.down <= 3
            && play.timing.start.running
            && play.timing.start.secondsLeft >= 3
            && play.timing.tempo === 'hurry_up';
          const validKneel = play.call.action === 'kneel'
            && play.playType === 'run'
            && play.result === 'kneel'
            && play.yardsGained === -1
            && play.timing.tempo === 'chew_clock';
          if (!validSpike && !validKneel) {
            fail('Saved game detail has invalid clock management.');
          }
        }
        previousRegulation = play.timing;
      } else {
        if (play.call.kind !== 'try' || !tryResultMatchesCall(play.call, play.result)) {
          fail('Saved game detail has an invalid try play.');
        }
        const exactOutcome = play.call.attempt === 'extra_point'
          ? play.playType === 'extra point' && play.yardsGained === 0
          : twoPointSucceeded(play.result)
            ? play.yardsGained === 3
            : play.yardsGained < 3;
        if (play.startingFP !== 97 || play.down !== 1 || play.yardsLeft !== 3
          || !exactOutcome) {
          fail('Saved game detail has an incoherent try situation or result.');
        }
        const followsTouchdown = previousPlayInDrive?.result === 'touchdown';
        const shootout = play.timing.context === 'overtime'
          && play.timing.period >= 3
          && previousPlayInDrive === null;
        if (!followsTouchdown && !shootout) {
          fail('Saved game detail has a try without a touchdown or overtime shootout.');
        }
        if (followsTouchdown && previousTiming?.kind === 'regulation') {
          if (play.timing.context !== 'regulation'
            || play.timing.quarter !== previousTiming.end.quarter
            || play.timing.secondsLeft !== previousTiming.end.secondsLeft) {
            fail('Saved game detail has incoherent regulation try timing.');
          }
        }
        if (followsTouchdown && previousTiming?.kind === 'overtime') {
          if (play.timing.context !== 'overtime'
            || play.timing.period !== previousTiming.period) {
            fail('Saved game detail has incoherent overtime try timing.');
          }
        }
        if (play.call.kind !== 'try') fail('Saved game detail has an invalid try call.');
        if (play.call.attempt === 'extra_point'
          && play.timing.context === 'overtime'
          && play.timing.period >= 2) {
          fail('Saved game detail kicks an illegal overtime extra point.');
        }
        if (play.timing.context === 'overtime') overtimeStarted = true;
      }
      previousTiming = play.timing;
      previousPlayInDrive = play;

      const required = requiredParticipantRoles(play);
      for (const role of PARTICIPANT_ROLES) {
        if (required.has(role) !== (play.participants[role] !== null)) {
          fail('Saved game detail has incoherent participant roles.');
        }
      }
      if ((play.result === 'fumble' || play.result === 'failed two point fumble')
        && play.participants.tacklerId !== play.participants.forcedFumbleById) {
        fail('Saved game detail has incoherent fumble participants.');
      }
    }
  }
  if ([...overtimePossessions.values()].some(possessions => possessions !== 2)) {
    fail('Saved game detail has an unpaired overtime period.');
  }
};

export function assertCurrentGameDetailRecord(
  value: unknown,
): asserts value is GameDetailRecord {
  assertDetailShape(value);
  assertDetailSemantics(value);
}

export function assertCurrentGameDetailRecords(
  value: unknown,
): asserts value is GameDetailRecord[] {
  if (!Array.isArray(value)) fail('Saved game details must be an array.');
  const details = value as unknown[];
  details.forEach(assertCurrentGameDetailRecord);
  const ids = (details as GameDetailRecord[]).map(detail => detail.gameId);
  if (new Set(ids).size !== ids.length) {
    fail('Saved game details contain duplicate game IDs.');
  }
}

const scoreDetail = (detail: GameDetailRecord, game: GameRecord) => {
  let scoreA = 0;
  let scoreB = 0;
  for (const drive of detail.drives) {
    const scoreABefore = scoreA;
    const scoreBBefore = scoreB;
    for (const play of drive.plays) {
      if (play.scoreA !== scoreA || play.scoreB !== scoreB) {
        fail(`Saved game detail ${detail.gameId} has incoherent play scores.`);
      }
      const offenseIsA = drive.offenseId === game.teamAId;
      const addOffense = (points: number) => {
        if (offenseIsA) scoreA += points;
        else scoreB += points;
      };
      if (play.result === 'touchdown') addOffense(6);
      else if (play.result === 'made field goal') addOffense(3);
      else if (play.result === 'made extra point') addOffense(1);
      else if (play.result === 'made two point run' || play.result === 'made two point pass') {
        addOffense(2);
      }
    }
    if (drive.result === 'safety') {
      if (drive.offenseId === game.teamAId) scoreB += 2;
      else scoreA += 2;
    }
    const offensePoints = drive.offenseId === game.teamAId
      ? scoreA - scoreABefore
      : scoreB - scoreBBefore;
    if (drive.points !== offensePoints) {
      fail(`Saved game detail ${detail.gameId} has incoherent drive points.`);
    }
    if (drive.scoreAAfter !== scoreA || drive.scoreBAfter !== scoreB) {
      fail(`Saved game detail ${detail.gameId} has incoherent drive scores.`);
    }
  }
  if (game.scoreA !== scoreA || game.scoreB !== scoreB) {
    fail(`Saved game detail ${detail.gameId} disagrees with its final game score.`);
  }
};

export const assertGameDetailReferences = ({
  details,
  games,
  currentPlayers,
  historicalPlayers = [],
  playerSeasons = [],
}: {
  details: unknown;
  games: GameRecord[];
  currentPlayers: PlayerRecord[];
  historicalPlayers?: HistoricalPlayerRecord[];
  playerSeasons?: PlayerSeasonStats[];
}) => {
  assertCurrentGameDetailRecords(details);
  const gamesById = new Map(games.map(game => [game.id, game]));
  const currentById = new Map(currentPlayers.map(player => [player.id, player]));
  const historicalById = new Map(historicalPlayers.map(player => [player.id, player]));
  const identityIds = new Set([...currentById.keys(), ...historicalById.keys()]);
  const seasonsByYearPlayer = new Map(
    playerSeasons.map(season => [`${season.year}:${season.playerId}`, season]),
  );

  for (const detail of details) {
    const game = gamesById.get(detail.gameId);
    if (!game || game.winnerId === null || game.year !== detail.year) {
      fail(`Saved game detail ${detail.gameId} has no matching completed game.`);
    }
    const teamIds = new Set([game.teamAId, game.teamBId]);
    for (const drive of detail.drives) {
      if (!teamIds.has(drive.offenseId) || !teamIds.has(drive.defenseId)) {
        fail(`Saved game detail ${detail.gameId} has an invalid team reference.`);
      }
      for (const play of drive.plays) {
        for (const role of PARTICIPANT_ROLES) {
          const playerId = play.participants[role];
          if (playerId === null) continue;
          if (!identityIds.has(playerId)) {
            fail(`Saved game detail ${detail.gameId} has a dangling participant identity.`);
          }
          const season = seasonsByYearPlayer.get(`${detail.year}:${playerId}`);
          const current = currentById.get(playerId);
          const historical = historicalById.get(playerId);
          const teamId = season?.teamId ?? current?.teamId;
          const position = season?.position ?? current?.pos ?? historical?.pos;
          const starter = season?.starter ?? current?.starter;
          const rule = PARTICIPANT_ROLE_RULES[role];
          const expectedTeamId = rule.side === 'offense'
            ? drive.offenseId
            : drive.defenseId;
          if (teamId !== expectedTeamId || starter !== true || !position
            || !participantPositionsForPlay(play.call, role).includes(position)) {
            fail(`Saved game detail ${detail.gameId} has an invalid participant role.`);
          }
        }
      }
    }
    for (const log of detail.playerStats) {
      const season = seasonsByYearPlayer.get(`${detail.year}:${log.playerId}`);
      const current = currentById.get(log.playerId);
      if (!identityIds.has(log.playerId)
        || !teamIds.has(season?.teamId ?? current?.teamId ?? -1)) {
        fail(`Saved game detail ${detail.gameId} has an invalid player-game identity.`);
      }
    }
    scoreDetail(detail, game);
  }
};
