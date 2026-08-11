import type {
  ClockTempo,
  DefensiveIntent,
  GameLogRecord,
  OffensiveConcept,
  PlayRecord,
  PlayTiming,
} from '../../types/db';
import type { SimGame, StartersCache } from '../../types/sim';
import {
  evaluateRatingPreservation,
  type RatingResult,
} from './calibrationMetrics';
import {
  samplePlayLiveBallSeconds,
  samplePotentialRunoffSeconds,
} from './clock';
import { OFFENSIVE_CONCEPTS, validatePlayCall } from './concepts';
import { tryResultMatchesCall, twoPointSucceeded } from './conversions';
import { DEFENSIVE_INTENTS } from './defensiveIntents';
import type { simGame } from './engine';
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

type DefaultGateInput = {
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
const average = (value: number, count: number) => count ? value / count : 0;
const inRange = (value: number, minimum: number, maximum: number) => (
  value >= minimum && value <= maximum
);
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
      && afterLiveSeconds <= 120;
    const outOfBoundsWindow = timing.outOfBounds && (
      (timing.start.quarter === 2 && afterLiveSeconds <= 120)
      || (timing.start.quarter === 4 && afterLiveSeconds <= 300)
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
      if (uses > 3
        || timing.eventAfter !== null
        || timing.elapsedSeconds !== liveBallSeconds
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
      && timing.start.secondsLeft >= 3
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
        totals.timeoutSecondsSaved += samplePotentialRunoffSeconds(
          play.id,
          play.playType,
          play.result,
          timing.tempo,
          clockAction,
          liveBallSeconds,
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
  evaluateGameTiming(drives, totals, violations);
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
      record.points_needed,
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
      if (play.result === 'safety') defenseScore = 2;
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

const evaluateBalance = (
  ratingResults: RatingResult[],
  metrics: DefaultGateInput['equalTeamMetrics'],
) => {
  const violations = evaluateRatingPreservation(ratingResults);
  const gates: Array<[string, number, number, number]> = [
    ['resolved plays', metrics.resolvedPlaysPerGame, 140, 153],
    ['drives', metrics.drivesPerGame, 22, 27],
    ['field goal attempts', metrics.fieldGoalAttemptsPerGame, 2, 4],
    ['overtime rate', metrics.overtimeGameRate, 0.03, 0.09],
  ];
  for (const [label, value, minimum, maximum] of gates) {
    if (!inRange(value, minimum, maximum)) {
      violations.push(`${label} ${value} is outside ${minimum}-${maximum}.`);
    }
  }
  return violations;
};

const evaluateClockManagement = (metrics: DefaultGateInput['clockMetrics']) => {
  const violations: string[] = [];
  const tempo = metrics.management.tempo;
  if (Object.values(tempo).some(value => value.plays === 0)) {
    violations.push('Not every clock tempo appeared in the default audit.');
  }
  if (!(tempo.hurry_up.averageRunoffSeconds < tempo.normal.averageRunoffSeconds
    && tempo.normal.averageRunoffSeconds < tempo.chew_clock.averageRunoffSeconds)) {
    violations.push('Tempo runoff relationships are not ordered hurry, normal, chew.');
  }
  if (metrics.management.chargedTimeoutsPerGame <= 0) {
    violations.push('Automatic teams did not use charged timeouts.');
  }
  if (metrics.management.spikesPerGame <= 0 || metrics.management.kneelsPerGame <= 0) {
    violations.push('Every automatic clock-management action did not appear.');
  }
  return violations;
};

const evaluateTries = (metrics: DefaultGateInput['tryMetrics']) => {
  const violations: string[] = [];
  if (!inRange(metrics.extraPoints.makeRate, 0.93, 0.99)) {
    violations.push(
      `Extra-point make rate ${metrics.extraPoints.makeRate} is outside 0.93-0.99.`,
    );
  }
  if (!inRange(metrics.twoPoints.conversionRate, 0.35, 0.65)) {
    violations.push(
      `Two-point conversion rate ${metrics.twoPoints.conversionRate} is outside 0.35-0.65.`,
    );
  }
  if (metrics.extraPoints.attempts === 0 || metrics.twoPoints.attempts === 0) {
    violations.push('The default audit did not produce both extra-point and two-point attempts.');
  }
  return violations;
};

const evaluateConcepts = (metrics: DefaultGateInput['conceptMetrics']) => {
  const violations: string[] = [];
  const fail = (message: string) => violations.push(message);
  for (const concept of OFFENSIVE_CONCEPTS) {
    if (metrics[concept].calls === 0) fail(`Concept ${concept} was not called.`);
  }
  const quick = metrics.quick_pass;
  const intermediate = metrics.intermediate_pass;
  const deep = metrics.deep_pass;
  const screen = metrics.screen;
  const playAction = metrics.play_action;
  const inside = metrics.inside_run;
  const outside = metrics.outside_run;
  const option = metrics.option;
  if (!(quick.completionRate > intermediate.completionRate
    && intermediate.completionRate > deep.completionRate)) {
    fail('Pass-concept completion rates are not ordered quick > intermediate > deep.');
  }
  if (!(quick.sackRate < deep.sackRate && quick.sackRate < playAction.sackRate
    && screen.sackRate < deep.sackRate && screen.sackRate < playAction.sackRate)) {
    fail('Pass-concept sack rates do not reflect their intended risk profiles.');
  }
  if (!(deep.yardsPerCompletion > quick.yardsPerCompletion
    && deep.yardsPerCompletion > intermediate.yardsPerCompletion
    && deep.explosiveRate > quick.explosiveRate
    && deep.explosiveRate > intermediate.explosiveRate)) {
    fail('Deep passes are not more explosive than quick and intermediate passes.');
  }
  if (!(outside.explosiveRate > inside.explosiveRate
    && outside.negativePlayRate > inside.negativePlayRate)) {
    fail('Outside runs are not more volatile than inside runs.');
  }
  if (!(option.fumbleRate > inside.fumbleRate)) {
    fail('Option fumble rate does not exceed inside-run fumble rate.');
  }
  return violations;
};

const evaluateDefensiveIntents = (
  metrics: DefaultGateInput['defensiveMetrics'],
  matchups: DefaultGateInput['defensiveMatchupMetrics'],
) => {
  const violations: string[] = [];
  const fail = (message: string) => violations.push(message);
  for (const intent of DEFENSIVE_INTENTS) {
    if (metrics[intent].calls === 0) fail(`Defensive intent ${intent} was not called.`);
    for (const concept of OFFENSIVE_CONCEPTS) {
      if (matchups[intent][concept].calls === 0) {
        fail(`Defensive matchup ${intent}/${concept} was not called.`);
      }
    }
  }

  const loadedInside = matchups.loaded_box.inside_run;
  const baseInside = matchups.base.inside_run;
  const coverageInside = matchups.coverage.inside_run;
  if (!(loadedInside.yardsPerPlay < baseInside.yardsPerPlay
    && loadedInside.yardsPerPlay < coverageInside.yardsPerPlay
    && loadedInside.successRate < baseInside.successRate
    && loadedInside.successRate < coverageInside.successRate)) {
    fail('Loaded box does not suppress inside runs more than base and coverage.');
  }

  const coverageDeep = matchups.coverage.deep_pass;
  const baseDeep = matchups.base.deep_pass;
  const loadedDeep = matchups.loaded_box.deep_pass;
  if (!(coverageDeep.completionRate < baseDeep.completionRate
    && coverageDeep.completionRate < loadedDeep.completionRate
    && coverageDeep.explosiveRate < baseDeep.explosiveRate
    && coverageDeep.explosiveRate < loadedDeep.explosiveRate)) {
    fail('Coverage does not suppress deep passes more than base and loaded box.');
  }

  if (!(metrics.pressure.sackRate > metrics.base.sackRate
    && metrics.pressure.sackRate > metrics.coverage.sackRate)) {
    fail('Pressure does not create more sacks than base and coverage.');
  }
  if (!(metrics.pressure.yardsPerCompletion > metrics.base.yardsPerCompletion
    && metrics.pressure.completedPassExplosiveRate
      > metrics.base.completedPassExplosiveRate)) {
    fail('Completed plays against pressure are not more explosive than base.');
  }

  const pressure = matchups.pressure;
  if (!(pressure.quick_pass.sackRate < pressure.deep_pass.sackRate
    && pressure.quick_pass.sackRate < pressure.play_action.sackRate
    && pressure.screen.sackRate < pressure.deep_pass.sackRate
    && pressure.screen.sackRate < pressure.play_action.sackRate)) {
    fail('Quick passes and screens do not mitigate pressure sacks as intended.');
  }
  if (!(matchups.loaded_box.play_action.yardsPerPlay
    > matchups.coverage.play_action.yardsPerPlay)) {
    fail('Play action does not perform better against loaded box than coverage.');
  }

  const runYards = (intent: DefensiveIntent) => {
    const runs = ['inside_run', 'outside_run', 'option'] as const;
    const calls = runs.reduce((sum, concept) => sum + matchups[intent][concept].calls, 0);
    const yards = runs.reduce((sum, concept) => (
      sum + matchups[intent][concept].yardsPerPlay * matchups[intent][concept].calls
    ), 0);
    return average(yards, calls);
  };
  if (!(runYards('coverage') > runYards('loaded_box'))) {
    fail('Runs do not perform better against coverage than loaded box.');
  }
  return violations;
};

export const evaluateDefaultSimulationGates = (input: DefaultGateInput) => [
  ...evaluateBalance(input.ratingResults, input.equalTeamMetrics),
  ...evaluateConcepts(input.conceptMetrics),
  ...evaluateDefensiveIntents(
    input.defensiveMetrics,
    input.defensiveMatchupMetrics,
  ),
  ...evaluateClockManagement(input.clockMetrics),
  ...evaluateTries(input.tryMetrics),
];
