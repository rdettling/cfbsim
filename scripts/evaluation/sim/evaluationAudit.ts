import type {
  ClockTempo,
  DefensiveIntent,
  GameLogRecord,
  OffensiveConcept,
  PlayRecord,
  PlayTiming,
} from '../../../src/types/db';
import type { SimGame, StartersCache } from '../../../src/types/sim';
import type { RatingResult } from './calibrationMetrics';
import {
  sampleGameRunoffMultiplier,
  samplePlayLiveBallSeconds,
  samplePotentialRunoffSeconds,
} from '../../../src/domain/sim/clock';
import { validatePlayCall } from '../../../src/domain/sim/concepts';
import { SIM_TUNING } from '../../../src/domain/sim/config';
import { tryResultMatchesCall, twoPointSucceeded } from '../../../src/domain/sim/conversions';
import type { simGame } from '../../../src/domain/sim/engine';
import { auditParticipantLinks } from './participantAudit';

type SimulatedDrives = ReturnType<typeof simGame>;
type TimingCategory =
  | 'run'
  | 'completedPass'
  | 'incompletePass'
  | 'sack'
  | 'specialTeams'
  | 'turnover';

export type EvaluationAuditTotals = {
  minimumFieldPosition: number;
  maximumFieldPosition: number;
  invalidFieldPositions: number;
  regulationPlays: number;
  runningAfter: number;
  stoppedAfter: number;
  firstDownStops: number;
  outOfBoundsStops: number;
  twoMinuteTimeouts: number;
  endOfQuarterEvents: number;
  halftimeEvents: number;
  endOfRegulationEvents: number;
  regulationElapsedSeconds: number;
  timingCategories: Record<TimingCategory, {
    plays: number;
    liveBallSeconds: number;
    elapsedSeconds: number;
  }>;
  tempo: Record<ClockTempo, {
    plays: number;
    elapsedSeconds: number;
    runoffPlays: number;
    runoffSeconds: number;
  }>;
  chargedTimeouts: number;
  offenseTimeouts: number;
  defenseTimeouts: number;
  firstHalfTimeouts: number;
  secondHalfTimeouts: number;
  spikes: number;
  kneels: number;
  timeoutSecondsSaved: number;
};

type ConceptMetric = {
  calls: number;
  yardsPerPlay: number;
  successRate: number;
  explosiveRate: number;
  negativePlayRate: number;
  fumbleRate: number;
  completionRate: number;
  sackRate: number;
  yardsPerCompletion: number;
  completedPassExplosiveRate: number;
};

export type DefaultGateInput = {
  ratingResults: RatingResult[];
  equalTeamMetrics: {
    resolvedPlaysPerGame: number;
    drivesPerGame: number;
    fieldGoalAttemptsPerGame: number;
    overtimeGameRate: number;
  };
  conceptMetrics: Record<OffensiveConcept, ConceptMetric>;
  defensiveMetrics: Record<DefensiveIntent, ConceptMetric>;
  defensiveMatchupMetrics: Record<
    DefensiveIntent,
    Record<OffensiveConcept, ConceptMetric>
  >;
  clockMetrics: {
    management: {
      tempo: Record<ClockTempo, {
        plays: number;
        averageRunoffSeconds: number;
      }>;
      chargedTimeoutsPerGame: number;
      spikesPerGame: number;
      kneelsPerGame: number;
    };
  };
  tryMetrics: {
    extraPoints: { attempts: number; makeRate: number };
    twoPoints: { attempts: number; conversionRate: number };
  };
};

const finite = (value: number) => Number.isFinite(value);
const addViolation = (violations: string[], message: string) => {
  if (!violations.includes(message)) violations.push(message);
};

const recordFieldPosition = (
  totals: EvaluationAuditTotals | null,
  value: number,
  violations: string[],
) => {
  if (totals) {
    totals.minimumFieldPosition = Math.min(totals.minimumFieldPosition, value);
    totals.maximumFieldPosition = Math.max(totals.maximumFieldPosition, value);
  }
  if (!finite(value) || value < 1 || value > 99) {
    if (totals) totals.invalidFieldPositions += 1;
    addViolation(violations, 'Simulation produced an invalid field position.');
  }
};

const timingCategory = (play: PlayRecord): TimingCategory => {
  if (play.result === 'interception' || play.result === 'fumble') return 'turnover';
  if (play.playType === 'run') return 'run';
  if (play.result === 'sack') return 'sack';
  if (play.result === 'incomplete pass') return 'incompletePass';
  if (play.playType === 'pass') return 'completedPass';
  return 'specialTeams';
};

const snapshotsMatch = (
  left: { quarter: number; secondsLeft: number; running: boolean },
  right: { quarter: number; secondsLeft: number; running: boolean },
) => left.quarter === right.quarter
  && left.secondsLeft === right.secondsLeft
  && left.running === right.running;

const expectedStartAfter = (
  timing: Extract<PlayTiming, { kind: 'regulation' }>,
) => {
  if (timing.eventAfter === 'end_of_quarter' || timing.eventAfter === 'halftime') {
    return {
      quarter: timing.end.quarter + 1,
      secondsLeft: 900,
      running: false,
    };
  }
  return timing.end;
};

const evaluateGameTiming = (
  game: SimGame,
  drives: SimulatedDrives,
  totals: EvaluationAuditTotals | null,
  violations: string[],
) => {
  const plays = drives.flatMap(drive => drive.plays);
  let previousRegulation: Extract<PlayTiming, { kind: 'regulation' }> | null = null;
  let regulationElapsed = 0;
  let twoMinuteTimeouts = 0;
  let endOfQuarterEvents = 0;
  let halftimeEvents = 0;
  let endOfRegulationEvents = 0;
  let overtimeStarted = false;
  let latestOvertimePeriod = 0;
  const timeoutUses = new Map<string, number>();

  for (const play of plays) {
    if (play.timing.kind === 'overtime') {
      if (play.call.kind === 'clock_management') {
        addViolation(violations, 'Simulation managed an overtime clock.');
      }
      if (!overtimeStarted && previousRegulation?.eventAfter !== 'end_of_regulation') {
        addViolation(violations, 'Simulation entered overtime before regulation ended.');
      }
      overtimeStarted = true;
      if (!Number.isInteger(play.timing.period) || play.timing.period < 1) {
        addViolation(violations, 'Simulation produced invalid overtime timing.');
      }
      if (latestOvertimePeriod > 0 && (
        play.timing.period < latestOvertimePeriod
        || play.timing.period > latestOvertimePeriod + 1
      )) addViolation(violations, 'Simulation produced incoherent overtime period ordering.');
      latestOvertimePeriod = Math.max(latestOvertimePeriod, play.timing.period);
      continue;
    }
    if (play.timing.kind === 'try') {
      if (play.call.kind !== 'try' || !tryResultMatchesCall(play.call, play.result)) {
        addViolation(violations, 'Simulation produced an incoherent try artifact.');
      }
      if (play.timing.context === 'overtime') {
        if (!overtimeStarted && previousRegulation?.eventAfter !== 'end_of_regulation') {
          addViolation(violations, 'Simulation entered an overtime try before regulation ended.');
        }
        overtimeStarted = true;
        if (play.timing.period < latestOvertimePeriod
          || play.timing.period > latestOvertimePeriod + 1) {
          addViolation(violations, 'Simulation produced incoherent overtime try ordering.');
        }
        latestOvertimePeriod = Math.max(latestOvertimePeriod, play.timing.period);
      } else {
        if (overtimeStarted) {
          addViolation(violations, 'Simulation returned to regulation try timing after overtime began.');
        }
        if (previousRegulation && (
          play.timing.quarter !== previousRegulation.end.quarter
          || play.timing.secondsLeft !== previousRegulation.end.secondsLeft
        )) addViolation(violations, 'Simulation produced mismatched regulation try timing.');
      }
      continue;
    }
    if (overtimeStarted) {
      addViolation(violations, 'Simulation returned to regulation timing after overtime began.');
    }
    const timing = play.timing;
    if (!previousRegulation) {
      if (!snapshotsMatch(timing.start, { quarter: 1, secondsLeft: 900, running: false })) {
        addViolation(violations, 'Regulation did not begin at Q1 15:00 with a stopped clock.');
      }
    } else if (previousRegulation.eventAfter === 'end_of_regulation') {
      addViolation(violations, 'Simulation produced a regulation play after regulation ended.');
    } else if (!snapshotsMatch(timing.start, expectedStartAfter(previousRegulation))) {
      addViolation(violations, 'Simulation produced a mismatched play timing chain.');
    }
    if (timing.start.quarter !== timing.end.quarter
      || timing.start.secondsLeft - timing.end.secondsLeft !== timing.elapsedSeconds
      || timing.elapsedSeconds < 0
      || !finite(timing.elapsedSeconds)) {
      addViolation(violations, 'Simulation produced inconsistent elapsed clock time.');
    }
    if (timing.end.secondsLeft < 0 || timing.end.secondsLeft > 900) {
      addViolation(violations, 'Simulation produced an invalid regulation timestamp.');
    }

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
    ].includes(play.result)
      || play.startingFP + play.yardsGained < 1
      || (play.down === 4
        && (play.playType === 'run' || play.playType === 'pass')
        && play.yardsGained < play.yardsLeft);
    const firstDown = play.yardsGained >= play.yardsLeft
      && !['touchdown', 'interception', 'fumble'].includes(play.result);
    const clockAction = play.call.kind === 'clock_management' ? play.call.action : null;
    const liveBallSeconds = Math.min(
      samplePlayLiveBallSeconds(play.id, play.playType, clockAction),
      timing.start.secondsLeft,
    );
    const afterLiveSeconds = timing.start.secondsLeft - liveBallSeconds;
    const lateFirstDown = firstDown
      && (timing.start.quarter === 2 || timing.start.quarter === 4)
      && afterLiveSeconds <= SIM_TUNING.clock.firstDownStopSeconds;
    const outOfBoundsWindow = timing.outOfBounds && (
      (timing.start.quarter === 2
        && afterLiveSeconds <= SIM_TUNING.clock.outOfBoundsStop.firstHalfSeconds)
      || (timing.start.quarter === 4
        && afterLiveSeconds <= SIM_TUNING.clock.outOfBoundsStop.secondHalfSeconds)
    );
    const shouldStop = terminal
      || lateFirstDown
      || outOfBoundsWindow
      || timing.eventAfter !== null
      || timing.chargedTimeoutAfter !== null
      || clockAction === 'spike';
    if (timing.end.running === shouldStop) {
      addViolation(violations, 'Simulation produced incoherent stopped-clock behavior.');
    }
    if (timing.outOfBounds && !(
      (play.playType === 'run' && play.result === 'run')
      || (play.playType === 'pass' && play.result === 'pass')
    )) addViolation(violations, 'Simulation produced an invalid out-of-bounds play.');
    if (timing.chargedTimeoutAfter) {
      const teamId = timing.chargedTimeoutAfter === 'offense'
        ? play.offenseId
        : play.defenseId;
      const half = timing.start.quarter <= 2 ? 1 : 2;
      const timeoutKey = `${half}:${teamId}`;
      const uses = (timeoutUses.get(timeoutKey) ?? 0) + 1;
      timeoutUses.set(timeoutKey, uses);
      const timeoutRunoffSeconds = timing.elapsedSeconds - liveBallSeconds;
      const validDelayedCloseout = timeoutRunoffSeconds > 0
        && timing.chargedTimeoutAfter === 'offense'
        && timing.start.quarter === 4
        && timing.end.secondsLeft === SIM_TUNING.clock.management.fieldGoalCloseoutTargetSeconds
        && timeoutRunoffSeconds <= SIM_TUNING.clock.management.maximumPostPlayRunoffSeconds
        && play.call.kind === 'scrimmage'
        && play.call.offense === 'inside_run'
        && play.startingFP
          >= SIM_TUNING.playcalling.fourthDown.fieldGoalRangeStartFieldPosition;
      if (uses > 3
        || timing.eventAfter !== null
        || (timeoutRunoffSeconds !== 0 && !validDelayedCloseout)
        || timing.end.running) {
        addViolation(violations, 'Simulation produced invalid charged timeout timing.');
      }
    }
    if (clockAction === 'spike' && !(
      play.playType === 'pass'
      && play.result === 'spike'
      && play.yardsGained === 0
      && play.down <= 3
      && timing.start.running
      && timing.start.secondsLeft >= SIM_TUNING.clock.management.minimumSpikeSeconds
      && timing.tempo === 'hurry_up'
      && timing.elapsedSeconds === liveBallSeconds
      && !timing.end.running
    )) addViolation(violations, 'Simulation produced invalid spike timing.');
    if (clockAction === 'kneel' && !(
      play.playType === 'run'
      && play.result === 'kneel'
      && play.yardsGained === -1
      && timing.tempo === 'chew_clock'
    )) addViolation(violations, 'Simulation produced invalid kneel timing.');

    if (timing.eventAfter === 'two_minute_timeout') twoMinuteTimeouts += 1;
    if (timing.eventAfter === 'end_of_quarter') endOfQuarterEvents += 1;
    if (timing.eventAfter === 'halftime') halftimeEvents += 1;
    if (timing.eventAfter === 'end_of_regulation') endOfRegulationEvents += 1;
    regulationElapsed += timing.elapsedSeconds;

    if (totals) {
      totals.regulationPlays += 1;
      if (timing.end.running) totals.runningAfter += 1;
      else totals.stoppedAfter += 1;
      if (lateFirstDown && !terminal) totals.firstDownStops += 1;
      if (outOfBoundsWindow) totals.outOfBoundsStops += 1;
      if (timing.eventAfter === 'two_minute_timeout') totals.twoMinuteTimeouts += 1;
      if (timing.eventAfter === 'end_of_quarter') totals.endOfQuarterEvents += 1;
      if (timing.eventAfter === 'halftime') totals.halftimeEvents += 1;
      if (timing.eventAfter === 'end_of_regulation') totals.endOfRegulationEvents += 1;
      totals.regulationElapsedSeconds += timing.elapsedSeconds;
      const tempo = totals.tempo[timing.tempo];
      tempo.plays += 1;
      tempo.elapsedSeconds += timing.elapsedSeconds;
      const runoffSeconds = timing.elapsedSeconds - liveBallSeconds;
      if (runoffSeconds > 0 && clockAction === null) {
        tempo.runoffPlays += 1;
        tempo.runoffSeconds += runoffSeconds;
      }
      if (timing.chargedTimeoutAfter) {
        totals.chargedTimeouts += 1;
        if (timing.chargedTimeoutAfter === 'offense') totals.offenseTimeouts += 1;
        else totals.defenseTimeouts += 1;
        if (timing.start.quarter <= 2) totals.firstHalfTimeouts += 1;
        else totals.secondHalfTimeouts += 1;
        const potentialRunoffSeconds = samplePotentialRunoffSeconds(
          play.id,
          play.playType,
          play.result,
          timing.tempo,
          clockAction,
          liveBallSeconds,
          sampleGameRunoffMultiplier(game),
        );
        const actualRunoffSeconds = Math.max(0, timing.elapsedSeconds - liveBallSeconds);
        totals.timeoutSecondsSaved += Math.max(
          0,
          potentialRunoffSeconds - actualRunoffSeconds,
        );
      }
      if (clockAction === 'spike') totals.spikes += 1;
      if (clockAction === 'kneel') totals.kneels += 1;
      const category = totals.timingCategories[timingCategory(play)];
      category.plays += 1;
      category.liveBallSeconds += liveBallSeconds;
      category.elapsedSeconds += timing.elapsedSeconds;
    }
    previousRegulation = timing;
  }

  if (regulationElapsed !== 3600) {
    addViolation(violations, 'Regulation timing does not total exactly 3,600 seconds.');
  }
  if (twoMinuteTimeouts !== 2
    || endOfQuarterEvents !== 2
    || halftimeEvents !== 1
    || endOfRegulationEvents !== 1) {
    addViolation(violations, 'Simulation produced missing or duplicate regulation clock events.');
  }
};

export const auditSimulatedGame = (
  game: SimGame,
  drives: SimulatedDrives,
  logs: GameLogRecord[],
  starters: StartersCache,
  totals: EvaluationAuditTotals | null,
  violations: string[],
) => {
  const plays = drives.flatMap(drive => drive.plays);
  for (const violation of auditParticipantLinks(game, plays, logs, starters)) {
    addViolation(violations, violation);
  }
  evaluateGameTiming(game, drives, totals, violations);
  const gameValues = [
    game.scoreA,
    game.scoreB,
    game.overtime,
    game.quarter,
    game.clockSecondsLeft,
  ];
  if (gameValues.some(value => !finite(value))) {
    addViolation(violations, 'Simulation produced a non-finite numeric field.');
  }
  const winnerMatchesScore =
    (game.winner?.id === game.teamA.id && game.scoreA > game.scoreB)
    || (game.winner?.id === game.teamB.id && game.scoreB > game.scoreA);
  if (!winnerMatchesScore) {
    addViolation(violations, 'Simulation produced an inconsistent final score/winner state.');
  }
  if ((game.winner?.id === game.teamA.id
      && (game.resultA !== 'W' || game.resultB !== 'L'))
    || (game.winner?.id === game.teamB.id
      && (game.resultA !== 'L' || game.resultB !== 'W'))) {
    addViolation(violations, 'Simulation produced inconsistent result fields.');
  }

  let scoreA = 0;
  let scoreB = 0;
  const overtimePossessions = new Map<number, number>();
  for (const drive of drives) {
    const record = drive.record;
    if (!record.result) {
      addViolation(violations, 'Simulation produced a drive without a result.');
    }
    recordFieldPosition(totals, record.startingFP, violations);
    recordFieldPosition(totals, drive.nextFieldPosition, violations);
    if ([
      record.points,
      record.scoreAAfter,
      record.scoreBAfter,
    ].some(value => !finite(value))) {
      addViolation(violations, 'Simulation produced a non-finite numeric field.');
    }
    const priorA = scoreA;
    const priorB = scoreB;
    const offenseIsA = record.offenseId === game.teamA.id;
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
      if (overtimePeriod <= 2 && record.startingFP !== 75) {
        addViolation(
          violations,
          'An ordinary overtime possession did not start at the 25-yard line.',
        );
      }
      if (overtimePeriod >= 3 && record.startingFP !== 97) {
        addViolation(
          violations,
          'An overtime shootout try did not start at the 3-yard line.',
        );
      }
    }

    const touchdownIndexes = drive.plays.flatMap((play, index) => (
      play.result === 'touchdown' ? [index] : []
    ));
    const tryIndexes = drive.plays.flatMap((play, index) => (
      play.call.kind === 'try' ? [index] : []
    ));
    if (touchdownIndexes.length > 1 || tryIndexes.length > 1) {
      addViolation(violations, 'A drive contains multiple touchdowns or tries.');
    }
    const touchdownIndex = touchdownIndexes[0] ?? null;
    const tryIndex = tryIndexes[0] ?? null;
    if (touchdownIndex !== null) {
      const touchdown = drive.plays[touchdownIndex];
      const tryPlay = tryIndex === null ? null : drive.plays[tryIndex];
      if (tryPlay && (tryIndex !== touchdownIndex + 1 || tryIndex !== drive.plays.length - 1)) {
        addViolation(
          violations,
          'A touchdown try is not the immediate final play of its drive.',
        );
      }
      if (tryPlay?.timing.kind === 'try') {
        const timingMatches = (touchdown.timing.kind === 'regulation'
          && tryPlay.timing.context === 'regulation'
          && tryPlay.timing.quarter === touchdown.timing.end.quarter
          && tryPlay.timing.secondsLeft === touchdown.timing.end.secondsLeft)
          || (touchdown.timing.kind === 'overtime'
            && tryPlay.timing.context === 'overtime'
            && tryPlay.timing.period === touchdown.timing.period);
        if (!timingMatches) {
          addViolation(violations, 'A try does not match its touchdown dead-ball timing.');
        }
      }
      if (overtimePeriod === 2 && tryPlay?.call.kind === 'try'
        && tryPlay.call.attempt === 'extra_point') {
        addViolation(violations, 'A second-overtime touchdown used an extra point.');
      }
      if (!tryPlay) {
        const offenseScoreAfterTouchdown = offenseIsA
          ? touchdown.scoreA + 6
          : touchdown.scoreB + 6;
        const defenseScoreAfterTouchdown = offenseIsA
          ? touchdown.scoreB
          : touchdown.scoreA;
        const leadAfterTouchdown = offenseScoreAfterTouchdown - defenseScoreAfterTouchdown;
        const terminalRegulation = touchdown.timing.kind === 'regulation'
          && touchdown.timing.end.quarter === 4
          && touchdown.timing.end.secondsLeft === 0;
        const terminalOvertime = overtimePeriod !== null && overtimePossession === 1;
        if (!(terminalRegulation || terminalOvertime)
          || (leadAfterTouchdown <= 0 && leadAfterTouchdown >= -2)) {
          addViolation(violations, 'A touchdown is missing its required try.');
        }
      }
      if (![6, 7, 8].includes(record.points)) {
        addViolation(violations, 'A touchdown drive did not finish with 6, 7, or 8 points.');
      }
    } else if (tryIndex !== null) {
      const tryPlay = drive.plays[tryIndex];
      if (!(overtimePeriod !== null
        && overtimePeriod >= 3
        && drive.plays.length === 1
        && tryPlay.call.kind === 'try'
        && tryPlay.call.attempt === 'two_point')) {
        addViolation(violations, 'A try appears without a preceding touchdown.');
      }
    }
    if (overtimePeriod !== null && overtimePeriod >= 3 && !(
      drive.plays.length === 1
      && firstPlay.call.kind === 'try'
      && firstPlay.call.attempt === 'two_point'
    )) {
      addViolation(
        violations,
        'Third-and-later overtime did not contain only a paired two-point try.',
      );
    }

    let playScoreA = priorA;
    let playScoreB = priorB;
    let offensePoints = 0;
    for (const play of drive.plays) {
      if (play.scoreA !== playScoreA || play.scoreB !== playScoreB) {
        addViolation(violations, 'A play contains incoherent pre-play score fields.');
      }
      let offenseScore = 0;
      let defenseScore = 0;
      if (play.result === 'touchdown') offenseScore = 6;
      if (play.result === 'made field goal') offenseScore = 3;
      if (play.result === 'made extra point') offenseScore = 1;
      if (twoPointSucceeded(play.result)) offenseScore = 2;
      offensePoints += offenseScore;
      if (offenseIsA) {
        playScoreA += offenseScore;
        playScoreB += defenseScore;
      } else {
        playScoreB += offenseScore;
        playScoreA += defenseScore;
      }
      if (play.call.kind === 'try' && (
        play.timing.kind !== 'try'
        || !tryResultMatchesCall(play.call, play.result)
      )) addViolation(violations, 'A try call, result, or timing is incoherent.');
      if (play.call.kind === 'try') {
        const exactSituation = play.startingFP === 97
          && play.down === 1
          && play.yardsLeft === 3;
        const exactOutcome = play.call.attempt === 'extra_point'
          ? play.playType === 'extra point' && play.yardsGained === 0
          : (twoPointSucceeded(play.result)
              ? play.yardsGained === 3
              : play.yardsGained < 3);
        if (!exactSituation || !exactOutcome) {
          addViolation(violations, 'A try has an incoherent situation or yardage result.');
        }
      }
    }
    if (record.result !== 'safety' && offensePoints !== record.points) {
      addViolation(violations, 'A drive point total does not match its scoring plays.');
    }
    scoreA = record.scoreAAfter;
    scoreB = record.scoreBAfter;
    const deltaA = scoreA - priorA;
    const deltaB = scoreB - priorB;
    if (record.result === 'safety') {
      const valid = offenseIsA
        ? deltaA === 0 && deltaB === 2
        : deltaA === 2 && deltaB === 0;
      if (!valid) addViolation(violations, 'Simulation produced inconsistent safety scoring.');
    } else {
      const valid = offenseIsA
        ? deltaA === record.points && deltaB === 0
        : deltaA === 0 && deltaB === record.points;
      if (!valid) addViolation(violations, 'Simulation produced inconsistent drive scoring.');
    }
    for (const play of drive.plays) {
      if (validatePlayCall(play.call, play.down, play.playType).length) {
        addViolation(violations, 'Simulation produced an invalid play call.');
      }
      recordFieldPosition(totals, play.startingFP, violations);
      if (!Number.isInteger(play.down) || play.down < 1 || play.down > 4) {
        addViolation(violations, 'Simulation produced an invalid down.');
      }
      const values = [play.yardsLeft, play.yardsGained, play.scoreA, play.scoreB];
      if (values.some(value => !finite(value))) {
        addViolation(violations, 'Simulation produced a non-finite numeric field.');
      }
    }
  }
  for (let period = 1; period <= game.overtime; period += 1) {
    if (overtimePossessions.get(period) !== 2) {
      addViolation(
        violations,
        'An overtime period does not contain a paired possession or try.',
      );
    }
  }
  if (scoreA !== game.scoreA || scoreB !== game.scoreB) {
    addViolation(violations, 'A final game score does not match its drives.');
  }
};
