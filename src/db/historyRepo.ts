import type {
  GameDetailRecord,
  HistoricalPlayerRecord,
  PlayTiming,
  PlayerRecord,
  PlayerSeasonStats,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
};
const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const IDENTITY_KEYS = [
  'id',
  'first',
  'last',
  'pos',
  'stars',
  'development_trait',
] as const;
export const isHistoricalPlayer = (
  value: unknown,
): value is HistoricalPlayerRecord =>
  isRecord(value) &&
  exact(value, IDENTITY_KEYS) &&
  Number.isInteger(value.id) &&
  typeof value.first === 'string' &&
  value.first.length > 0 &&
  typeof value.last === 'string' &&
  value.last.length > 0 &&
  typeof value.pos === 'string' &&
  value.pos.length > 0 &&
  finite(value.stars) &&
  finite(value.development_trait);

const PLAYER_SEASON_KEYS = [
  'year',
  'playerId',
  'teamId',
  'position',
  'classYear',
  'rating',
  'starter',
  'games',
  ...PLAYER_SEASON_STAT_KEYS,
] as const;
export const isPlayerSeason = (value: unknown): value is PlayerSeasonStats =>
  isRecord(value) &&
  exact(value, PLAYER_SEASON_KEYS) &&
  Number.isInteger(value.year) &&
  Number.isInteger(value.playerId) &&
  Number.isInteger(value.teamId) &&
  typeof value.position === 'string' &&
  ['fr', 'so', 'jr', 'sr'].includes(String(value.classYear)) &&
  finite(value.rating) &&
  typeof value.starter === 'boolean' &&
  Number.isInteger(value.games) &&
  Number(value.games) > 0 &&
  PLAYER_SEASON_STAT_KEYS.every(key => finite(value[key]));

const DETAIL_PLAY_KEYS = [
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
const isPlayParticipants = (value: unknown) =>
  isRecord(value) &&
  exact(value, PARTICIPANT_ROLES) &&
  PARTICIPANT_ROLES.every(role =>
    value[role] === null || Number.isInteger(value[role]),
  );
const CLOCK_EVENTS = [
  'two_minute_timeout',
  'end_of_quarter',
  'halftime',
  'end_of_regulation',
] as const;
const isClockSnapshot = (value: unknown) => isRecord(value)
  && exact(value, ['quarter', 'secondsLeft', 'running'])
  && Number.isInteger(value.quarter)
  && Number(value.quarter) >= 1
  && Number(value.quarter) <= 4
  && Number.isInteger(value.secondsLeft)
  && Number(value.secondsLeft) >= 0
  && Number(value.secondsLeft) <= 900
  && typeof value.running === 'boolean';
export const isPlayTiming = (value: unknown) => {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'overtime') {
    return exact(value, ['kind', 'period', 'outOfBounds'])
      && Number.isInteger(value.period)
      && Number(value.period) >= 1
      && typeof value.outOfBounds === 'boolean';
  }
  if (value.kind === 'try') {
    if (value.context === 'regulation') {
      return exact(value, ['kind', 'context', 'quarter', 'secondsLeft'])
        && Number.isInteger(value.quarter)
        && Number(value.quarter) >= 1
        && Number(value.quarter) <= 4
        && Number.isInteger(value.secondsLeft)
        && Number(value.secondsLeft) >= 0
        && Number(value.secondsLeft) <= 900;
    }
    return value.context === 'overtime'
      && exact(value, ['kind', 'context', 'period'])
      && Number.isInteger(value.period)
      && Number(value.period) >= 1;
  }
  if (value.kind !== 'regulation'
    || !exact(value, [
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
    || !Number.isInteger(value.elapsedSeconds)
    || Number(value.elapsedSeconds) < 0
    || typeof value.outOfBounds !== 'boolean'
    || !['normal', 'hurry_up', 'chew_clock'].includes(String(value.tempo))
    || !(value.eventAfter === null
      || CLOCK_EVENTS.includes(value.eventAfter as typeof CLOCK_EVENTS[number]))
    || !(value.chargedTimeoutAfter === null
      || value.chargedTimeoutAfter === 'offense'
      || value.chargedTimeoutAfter === 'defense')
    || (value.eventAfter !== null && value.chargedTimeoutAfter !== null)) {
    return false;
  }
  const start = value.start as Record<string, unknown>;
  const end = value.end as Record<string, unknown>;
  if (start.quarter !== end.quarter
    || Number(start.secondsLeft) - Number(end.secondsLeft) !== value.elapsedSeconds) {
    return false;
  }
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
const DETAIL_DRIVE_KEYS = [
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
const LOG_KEYS = ['playerId', ...PLAYER_SEASON_STAT_KEYS] as const;
export const isGameDetail = (value: unknown): value is GameDetailRecord => {
  if (
    !isRecord(value) ||
    !exact(value, ['gameId', 'year', 'drives', 'playerStats']) ||
    !Number.isInteger(value.gameId) ||
    !Number.isInteger(value.year) ||
    !Array.isArray(value.drives) ||
    !Array.isArray(value.playerStats)
  ) return false;
  return value.drives.every(drive =>
    isRecord(drive) &&
    exact(drive, DETAIL_DRIVE_KEYS) &&
    ['driveNum', 'offenseId', 'defenseId', 'startingFP', 'points',
      'scoreAAfter', 'scoreBAfter'].every(key => finite(drive[key])) &&
    typeof drive.result === 'string' &&
    Array.isArray(drive.plays) &&
    drive.plays.every(play =>
      isRecord(play) &&
      exact(play, DETAIL_PLAY_KEYS) &&
      DETAIL_PLAY_KEYS.every(key =>
        ['playType', 'result', 'text', 'header'].includes(key)
          ? typeof play[key] === 'string'
          : key === 'participants'
            ? isPlayParticipants(play[key])
            : key === 'call'
              ? isPlayCall(play[key])
              : key === 'timing'
                ? isPlayTiming(play[key])
              : finite(play[key]),
      ),
    ),
  ) && value.playerStats.every(log =>
    isRecord(log) &&
    exact(log, LOG_KEYS) &&
    Number.isInteger(log.playerId) &&
    PLAYER_SEASON_STAT_KEYS.every(key => finite(log[key])),
  );
};

export const assertHistoricalIntegrity = ({
  currentPlayers,
  historicalPlayers,
  playerSeasons,
  details,
  gameIds,
}: {
  currentPlayers: PlayerRecord[];
  historicalPlayers: HistoricalPlayerRecord[];
  playerSeasons: PlayerSeasonStats[];
  details: GameDetailRecord[];
  gameIds: Set<number>;
}) => {
  if (
    historicalPlayers.some(player => !isHistoricalPlayer(player)) ||
    playerSeasons.some(season => !isPlayerSeason(season)) ||
    details.some(detail => !isGameDetail(detail) || !gameIds.has(detail.gameId))
  ) throw new Error('Saved historical data does not match the current data model.');
  const currentIds = new Set(currentPlayers.map(player => player.id));
  const historicalIds = new Set<number>();
  for (const player of historicalPlayers) {
    if (currentIds.has(player.id) || historicalIds.has(player.id)) {
      throw new Error('Player identity appears in multiple stores.');
    }
    historicalIds.add(player.id);
  }
  const identityIds = new Set([...currentIds, ...historicalIds]);
  const currentById = new Map(currentPlayers.map(player => [player.id, player]));
  const historicalById = new Map(historicalPlayers.map(player => [player.id, player]));
  const seasonKeys = new Set<string>();
  const seasonsByYearPlayer = new Map<string, PlayerSeasonStats>();
  for (const season of playerSeasons) {
    const key = `${season.year}:${season.playerId}`;
    if (!identityIds.has(season.playerId) || seasonKeys.has(key)) {
      throw new Error('Player season has a dangling or duplicate identity.');
    }
    seasonKeys.add(key);
    seasonsByYearPlayer.set(key, season);
  }
  for (const detail of details) {
    if (detail.playerStats.some(log => !identityIds.has(log.playerId))) {
      throw new Error('Game detail has a dangling player identity.');
    }
    let previousTiming: PlayTiming | null = null;
    let previousRegulation: Extract<PlayTiming, { kind: 'regulation' }> | null = null;
    let overtimeStarted = false;
    const timeoutUses = new Map<string, number>();
    const overtimePossessions = new Map<number, number>();
    for (const drive of detail.drives) {
      const firstPlay = drive.plays[0];
      const overtimePeriod = firstPlay?.timing.kind === 'overtime'
        ? firstPlay.timing.period
        : firstPlay?.timing.kind === 'try' && firstPlay.timing.context === 'overtime'
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
          throw new Error('Game detail has a try outside the end of its touchdown drive.');
        }
        if (!tryPlay) {
          const terminalRegulation = touchdown.timing.kind === 'regulation'
            && touchdown.timing.end.quarter === 4
            && touchdown.timing.end.secondsLeft === 0;
          const terminalOvertime = overtimePeriod !== null && overtimePossession === 1;
          if (!terminalRegulation && !terminalOvertime) {
            throw new Error('Game detail has a touchdown without a required try.');
          }
        }
        const expectedPoints = !tryPlay || tryPlay.call.kind !== 'try'
          ? 6
          : tryPlay.call.attempt === 'extra_point'
            ? tryPlay.result === 'made extra point' ? 7 : 6
            : twoPointSucceeded(tryPlay.result) ? 8 : 6;
        if (drive.points !== expectedPoints) {
          throw new Error('Game detail has incoherent touchdown-drive points.');
        }
      } else if (tryIndex >= 0) {
        const tryPlay = drive.plays[tryIndex];
        const shootout = overtimePeriod !== null
          && overtimePeriod >= 3
          && drive.plays.length === 1
          && tryPlay.call.kind === 'try'
          && tryPlay.call.attempt === 'two_point';
        if (!shootout) throw new Error('Game detail has a try without a touchdown.');
        const expectedPoints = twoPointSucceeded(tryPlay.result) ? 2 : 0;
        if (drive.points !== expectedPoints) {
          throw new Error('Game detail has incoherent overtime-try points.');
        }
      }
      if (overtimePeriod !== null && overtimePeriod >= 3 && !(
        drive.plays.length === 1
        && firstPlay.call.kind === 'try'
        && firstPlay.call.attempt === 'two_point'
      )) throw new Error('Game detail has an invalid third-or-later overtime possession.');
      let previousPlayInDrive: (typeof drive.plays)[number] | null = null;
      for (const play of drive.plays) {
        if (validatePlayCall(play.call, play.down, play.playType).length) {
          throw new Error('Game detail has an invalid play call.');
        }
        if ((play.call.kind === 'try') !== (play.timing.kind === 'try')) {
          throw new Error('Game detail has incoherent try call and timing.');
        }
        if (
          play.timing.kind !== 'try'
          && play.timing.outOfBounds
          && !(
            (play.playType === 'run' && play.result === 'run')
            || (play.playType === 'pass' && play.result === 'pass')
          )
        ) throw new Error('Game detail has incoherent out-of-bounds timing.');
        if (play.timing.kind === 'overtime') {
          if (play.call.kind === 'clock_management') {
            throw new Error('Game detail manages an overtime clock.');
          }
          if (
            !overtimeStarted
            && previousRegulation
            && previousRegulation.eventAfter !== 'end_of_regulation'
          ) throw new Error('Game detail enters overtime before regulation ends.');
          overtimeStarted = true;
        } else if (play.timing.kind === 'regulation') {
          if (overtimeStarted) {
            throw new Error('Game detail returns to regulation after overtime begins.');
          }
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
            ) throw new Error('Game detail has an incoherent timing chain.');
          }
          if (play.timing.chargedTimeoutAfter) {
            const teamId = play.timing.chargedTimeoutAfter === 'offense'
              ? drive.offenseId
              : drive.defenseId;
            const half = play.timing.start.quarter <= 2 ? 1 : 2;
            const key = `${half}:${teamId}`;
            const uses = (timeoutUses.get(key) ?? 0) + 1;
            timeoutUses.set(key, uses);
            if (uses > 3) throw new Error('Game detail exceeds charged timeout limits.');
            const terminal = [
              'incomplete pass',
              'interception',
              'fumble',
              'touchdown',
              'safety',
              'turnover on downs',
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
              throw new Error('Game detail charges a timeout after a stopped-clock play.');
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
              throw new Error('Game detail has invalid clock management.');
            }
          }
          previousRegulation = play.timing;
        } else {
          if (play.call.kind !== 'try' || !tryResultMatchesCall(play.call, play.result)) {
            throw new Error('Game detail has an invalid try play.');
          }
          const exactOutcome = play.call.attempt === 'extra_point'
            ? play.playType === 'extra point' && play.yardsGained === 0
            : twoPointSucceeded(play.result)
              ? play.yardsGained === 3
              : play.yardsGained < 3;
          if (play.startingFP !== 97
            || play.down !== 1
            || play.yardsLeft !== 3
            || !exactOutcome) {
            throw new Error('Game detail has an incoherent try situation or result.');
          }
          const followsTouchdown = previousPlayInDrive?.result === 'touchdown';
          const shootout = play.timing.context === 'overtime'
            && play.timing.period >= 3
            && previousPlayInDrive === null;
          if (!followsTouchdown && !shootout) {
            throw new Error('Game detail has a try without a touchdown or overtime shootout.');
          }
          if (followsTouchdown && previousTiming?.kind === 'regulation') {
            if (play.timing.context !== 'regulation'
              || play.timing.quarter !== previousTiming.end.quarter
              || play.timing.secondsLeft !== previousTiming.end.secondsLeft) {
              throw new Error('Game detail has incoherent regulation try timing.');
            }
          }
          if (followsTouchdown && previousTiming?.kind === 'overtime') {
            if (play.timing.context !== 'overtime'
              || play.timing.period !== previousTiming.period) {
              throw new Error('Game detail has incoherent overtime try timing.');
            }
          }
          if (play.call.attempt === 'extra_point'
            && play.timing.context === 'overtime'
            && play.timing.period >= 2) {
            throw new Error('Game detail kicks an illegal overtime extra point.');
          }
          if (play.timing.context === 'overtime') overtimeStarted = true;
        }
        previousTiming = play.timing;
        previousPlayInDrive = play;
        const required = requiredParticipantRoles(play);
        for (const role of PARTICIPANT_ROLES) {
          const playerId = play.participants[role];
          if (required.has(role) !== (playerId !== null)) {
            throw new Error('Game detail has incoherent participant roles.');
          }
          if (playerId === null) continue;
          if (!identityIds.has(playerId)) {
            throw new Error('Game detail has a dangling participant identity.');
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
          if (
            teamId !== expectedTeamId
            || starter !== true
            || !position
            || !participantPositionsForPlay(play.call, role).includes(position)
          ) {
            throw new Error('Game detail has an invalid participant role.');
          }
        }
        if (
          (play.result === 'fumble' || play.result === 'failed two point fumble')
          && play.participants.tacklerId !== play.participants.forcedFumbleById
        ) throw new Error('Game detail has incoherent fumble participants.');
      }
    }
    if ([...overtimePossessions.values()].some(possessions => possessions !== 2)) {
      throw new Error('Game detail has an unpaired overtime period.');
    }
  }
};
