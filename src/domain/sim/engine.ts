import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { SimGame, SimDrive, StartersCache } from '../../types/sim';
import type { Drive, GameData } from '../../types/game';
import type { GameRecord, DriveRecord, PlayRecord, GameLogRecord, PlayerRecord } from '../../types/db';
import { getPlayersByTeam } from '../../db/simRepo';
import {
  SECONDS_PER_QUARTER,
  applyPlayClock,
  totalSecondsLeft,
  getTempo,
  isOutOfBoundsResult,
  type ClockState,
  type ClockPlayContext,
} from './clock';
import { kickoffStartFieldPosition } from './kickoffs';
import { choosePlayType, decideFourthDown, pointsNeeded } from './playcalling';
import { fieldGoal, simPass, simRun } from './outcomes';
import { formatPlayText, setPlayHeader, startingYardsLeft, chooseReceiver, weightedChoice } from './plays';

export const OT_START_YARD_LINE = 75;
export { SECONDS_PER_QUARTER } from './clock';
export { kickoffStartFieldPosition } from './kickoffs';

export type SimContext = {
  league: LeagueState;
  game: SimGame;
  starters: StartersCache;
  offense: Team;
  defense: Team;
  lead: number;
  clockEnabled: boolean;
};

const updateDriveScoreAfter = (game: SimGame, drive: DriveRecord, offense: Team) => {
  if (drive.result !== 'safety') {
    if (offense.id === game.teamA.id) {
      drive.scoreAAfter += drive.points;
    } else {
      drive.scoreBAfter += drive.points;
    }
  } else {
    if (offense.id === game.teamA.id) {
      drive.scoreBAfter += 2;
    } else {
      drive.scoreAAfter += 2;
    }
  }
};

export const isTeamAOpeningOffense = (game: SimGame) => {
  if (game.neutralSite) return true;
  if (game.awayTeam) {
    return game.awayTeam.id === game.teamA.id;
  }
  if (game.homeTeam) {
    return game.homeTeam.id !== game.teamA.id;
  }
  return true;
};

export const simDrive = (
  context: SimContext,
  fieldPosition: number,
  driveNum: number
): SimDrive => {
  const {
    league,
    game,
    starters,
    offense,
    defense,
    lead,
    clockEnabled,
  } = context;
  const clock: ClockState = {
    quarter: game.quarter,
    secondsLeft: game.clockSecondsLeft,
    clockRunning: game.clockRunning,
  };
  const needed = clockEnabled ? pointsNeeded(lead, totalSecondsLeft(clock)) : 0;
  const driveId = game.id * 1000 + driveNum;

  const drive: DriveRecord = {
    id: driveId,
    gameId: game.id,
    driveNum,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: fieldPosition,
    result: '',
    points: 0,
    points_needed: needed,
    scoreAAfter: game.scoreA,
    scoreBAfter: game.scoreB,
  };

  const plays: PlayRecord[] = [];
  let yardsLeft = 10;
  const applyClock = (context: ClockPlayContext) => {
    if (!clockEnabled) {
      return {
        clock,
        playSeconds: 0,
        halfEnded: false,
        gameEnded: false,
      };
    }
    return applyPlayClock(clock, context);
  };

  while (!drive.result) {
    for (let down = 1; down <= 4; down += 1) {
      const playId = driveId * 1000 + plays.length + 1;
      if (down === 1) {
        yardsLeft = startingYardsLeft(fieldPosition);
      }

      const play: PlayRecord = {
        id: playId,
        gameId: game.id,
        driveId: driveId,
        offenseId: offense.id,
        defenseId: defense.id,
        startingFP: fieldPosition,
        down,
        yardsLeft,
        playType: '',
        yardsGained: 0,
        result: '',
        text: '',
        header: '',
        scoreA: game.scoreA,
        scoreB: game.scoreB,
      };

      setPlayHeader(play, offense, defense);

      const tempo = getTempo(lead, clock);
      if (down === 4) {
        const decision = decideFourthDown(fieldPosition, yardsLeft, needed);
        if (decision === 'field_goal') {
          play.playType = 'field goal';
          play.yardsGained = 0;
          if (fieldGoal(fieldPosition)) {
            play.result = 'made field goal';
            drive.result = 'made field goal';
            drive.points = 3;
            updateDriveScoreAfter(game, drive, offense);
          } else {
            play.result = 'missed field goal';
            drive.result = 'missed field goal';
          }
          play.quarter = clock.quarter;
          play.clockSecondsLeft = clock.secondsLeft;
          const clockResult = applyClock({
            playType: play.playType,
            result: play.result,
            isFirstDown: false,
            isOutOfBounds: false,
            tempo,
          });
          play.playSeconds = clockResult.playSeconds;
          game.quarter = clockResult.clock.quarter;
          game.clockSecondsLeft = clockResult.clock.secondsLeft;
          game.clockRunning = clockResult.clock.clockRunning;
          clock.quarter = clockResult.clock.quarter;
          clock.secondsLeft = clockResult.clock.secondsLeft;
          clock.clockRunning = clockResult.clock.clockRunning;
          formatPlayText(play, offense, defense, starters);
          plays.push(play);
          return {
            record: drive,
            plays,
            nextFieldPosition: play.result === 'made field goal'
              ? kickoffStartFieldPosition()
              : 100 - fieldPosition,
          };
        }
        if (decision === 'punt') {
          play.playType = 'punt';
          play.result = 'punt';
          play.yardsGained = 0;
          drive.result = 'punt';
          drive.points = 0;
          play.quarter = clock.quarter;
          play.clockSecondsLeft = clock.secondsLeft;
          const clockResult = applyClock({
            playType: play.playType,
            result: play.result,
            isFirstDown: false,
            isOutOfBounds: false,
            tempo,
          });
          play.playSeconds = clockResult.playSeconds;
          game.quarter = clockResult.clock.quarter;
          game.clockSecondsLeft = clockResult.clock.secondsLeft;
          game.clockRunning = clockResult.clock.clockRunning;
          clock.quarter = clockResult.clock.quarter;
          clock.secondsLeft = clockResult.clock.secondsLeft;
          clock.clockRunning = clockResult.clock.clockRunning;
          formatPlayText(play, offense, defense, starters);
          plays.push(play);
          return {
            record: drive,
            plays,
            nextFieldPosition: 100 - (fieldPosition + 40),
          };
        }
      }

      const playType = choosePlayType(down, yardsLeft, tempo, lead, clock);
      const result = playType === 'run'
        ? simRun(fieldPosition, offense, defense, game)
        : simPass(fieldPosition, offense, defense, game);

      play.playType = playType;
      play.yardsGained = result.yards;
      play.result = result.outcome;
      fieldPosition += result.yards;
      yardsLeft -= result.yards;
      play.yardsLeft = yardsLeft;

      const achievedFirstDown = yardsLeft <= 0
        && result.outcome !== 'touchdown'
        && result.outcome !== 'interception'
        && result.outcome !== 'fumble';
      const outOfBounds = isOutOfBoundsResult(play.playType, play.result);

      play.quarter = clock.quarter;
      play.clockSecondsLeft = clock.secondsLeft;
      const clockResult = applyClock({
        playType: play.playType,
        result: play.result,
        isFirstDown: achievedFirstDown,
        isOutOfBounds: outOfBounds,
        tempo,
      });
      play.playSeconds = clockResult.playSeconds;
      game.quarter = clockResult.clock.quarter;
      game.clockSecondsLeft = clockResult.clock.secondsLeft;
      game.clockRunning = clockResult.clock.clockRunning;
      clock.quarter = clockResult.clock.quarter;
      clock.secondsLeft = clockResult.clock.secondsLeft;
      clock.clockRunning = clockResult.clock.clockRunning;

      formatPlayText(play, offense, defense, starters);
      plays.push(play);

      if (result.outcome === 'touchdown') {
        drive.result = 'touchdown';
        drive.points = 7;
        updateDriveScoreAfter(game, drive, offense);
        return { record: drive, plays, nextFieldPosition: kickoffStartFieldPosition() };
      }
      if (result.outcome === 'interception') {
        drive.result = 'interception';
        return { record: drive, plays, nextFieldPosition: 100 - fieldPosition };
      }
      if (result.outcome === 'fumble') {
        drive.result = 'fumble';
        return { record: drive, plays, nextFieldPosition: 100 - fieldPosition };
      }
      if (fieldPosition < 1) {
        drive.result = 'safety';
        drive.points = 0;
        updateDriveScoreAfter(game, drive, offense);
        return { record: drive, plays, nextFieldPosition: kickoffStartFieldPosition() };
      }
      if (down === 4 && yardsLeft > 0) {
        drive.result = 'turnover on downs';
        return { record: drive, plays, nextFieldPosition: 100 - fieldPosition };
      }

      if (clockResult.halfEnded) {
        drive.result = 'end of half';
        return { record: drive, plays, nextFieldPosition: kickoffStartFieldPosition() };
      }
      if (clockResult.gameEnded) {
        drive.result = 'end of game';
        return { record: drive, plays, nextFieldPosition: kickoffStartFieldPosition() };
      }

      if (yardsLeft <= 0) {
        down = 0;
        yardsLeft = startingYardsLeft(fieldPosition);
        break;
      }
    }
  }

  return { record: drive, plays, nextFieldPosition: 20 };
};

export const startInteractiveDrive = (
  context: SimContext,
  fieldPosition: number,
  driveNum: number
) => {
  const { league, game, offense, defense, lead, clockEnabled } = context;
  const needed = clockEnabled
    ? pointsNeeded(
      lead,
      totalSecondsLeft({
        quarter: game.quarter,
        secondsLeft: game.clockSecondsLeft,
        clockRunning: game.clockRunning,
      })
    )
    : 0;
  const driveId = game.id * 1000 + driveNum;

  const drive: DriveRecord = {
    id: driveId,
    gameId: game.id,
    driveNum,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: fieldPosition,
    result: '',
    points: 0,
    points_needed: needed,
    scoreAAfter: game.scoreA,
    scoreBAfter: game.scoreB,
  };

  return {
    drive,
    fieldPosition,
    down: 1,
    yardsLeft: startingYardsLeft(fieldPosition),
    playCount: 0,
  };
};

export const stepInteractiveDrive = (
  context: SimContext,
  state: {
    drive: DriveRecord;
    fieldPosition: number;
    down: number;
    yardsLeft: number;
    playCount: number;
  },
  decision: 'run' | 'pass' | 'punt' | 'field_goal' | 'auto',
  clockEnabledOverride?: boolean
) => {
  const { league, game, starters, offense, defense, lead, clockEnabled } = context;
  const applyClockEnabled = clockEnabledOverride ?? clockEnabled;
  const clockState = { quarter: game.quarter, secondsLeft: game.clockSecondsLeft, clockRunning: game.clockRunning };
  const tempo = getTempo(lead, clockState);
  const playId = state.drive.id * 1000 + state.playCount + 1;
  state.playCount += 1;
  const down = state.down;
  const fieldPosition = state.fieldPosition;
  const yardsLeft = down === 1 ? startingYardsLeft(fieldPosition) : state.yardsLeft;

  const play: PlayRecord = {
    id: playId,
    gameId: game.id,
    driveId: state.drive.id,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: fieldPosition,
    down,
    yardsLeft,
    playType: '',
    yardsGained: 0,
    result: '',
    text: '',
    header: '',
    scoreA: game.scoreA,
    scoreB: game.scoreB,
  };

  setPlayHeader(play, offense, defense);

  const resolveAutoDecision = () => {
    if (down === 4) {
      const auto = decideFourthDown(fieldPosition, yardsLeft, state.drive.points_needed);
      if (auto === 'punt' || auto === 'field_goal') return auto;
      return choosePlayType(down, yardsLeft, tempo, lead, clockState);
    }
    return choosePlayType(down, yardsLeft, tempo, lead, clockState);
  };

  const pickDecision = decision === 'auto' ? resolveAutoDecision() : decision;

  if (down === 4 && (pickDecision === 'field_goal' || pickDecision === 'punt')) {
    if (pickDecision === 'field_goal') {
      play.playType = 'field goal';
      play.yardsGained = 0;
      if (fieldGoal(fieldPosition)) {
        play.result = 'made field goal';
        state.drive.result = 'made field goal';
        state.drive.points = 3;
        updateDriveScoreAfter(game, state.drive, offense);
      } else {
        play.result = 'missed field goal';
        state.drive.result = 'missed field goal';
      }
      play.quarter = game.quarter;
      play.clockSecondsLeft = game.clockSecondsLeft;
      const clockResult = applyClockEnabled
        ? applyPlayClock(clockState, {
          playType: play.playType,
          result: play.result,
          isFirstDown: false,
          isOutOfBounds: false,
          tempo,
        })
        : {
          clock: clockState,
          playSeconds: 0,
          halfEnded: false,
          gameEnded: false,
        };
      play.playSeconds = clockResult.playSeconds;
      game.quarter = clockResult.clock.quarter;
      game.clockSecondsLeft = clockResult.clock.secondsLeft;
      game.clockRunning = clockResult.clock.clockRunning;
      formatPlayText(play, offense, defense, starters);
      if (state.drive.result === 'made field goal') {
        game.scoreA = state.drive.scoreAAfter;
        game.scoreB = state.drive.scoreBAfter;
      }
      return {
        state,
        play,
        driveComplete: true,
        nextFieldPosition: state.drive.result === 'made field goal'
          ? kickoffStartFieldPosition()
          : 100 - fieldPosition,
        gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
      };
    }

    play.playType = 'punt';
    play.result = 'punt';
    play.yardsGained = 0;
    state.drive.result = 'punt';
    state.drive.points = 0;
    play.quarter = game.quarter;
    play.clockSecondsLeft = game.clockSecondsLeft;
    const clockResult = applyClockEnabled
      ? applyPlayClock(clockState, {
        playType: play.playType,
        result: play.result,
        isFirstDown: false,
        isOutOfBounds: false,
        tempo,
      })
      : {
        clock: clockState,
        playSeconds: 0,
        halfEnded: false,
        gameEnded: false,
      };
    play.playSeconds = clockResult.playSeconds;
    game.quarter = clockResult.clock.quarter;
    game.clockSecondsLeft = clockResult.clock.secondsLeft;
    game.clockRunning = clockResult.clock.clockRunning;
    formatPlayText(play, offense, defense, starters);
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - (fieldPosition + 40),
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }

  const playType = pickDecision === 'pass' ? 'pass' : 'run';
  const result = playType === 'run'
    ? simRun(fieldPosition, offense, defense, game)
    : simPass(fieldPosition, offense, defense, game);

  play.playType = playType;
  play.yardsGained = result.yards;
  play.result = result.outcome;

  let nextFieldPosition = fieldPosition + result.yards;
  let nextYardsLeft = yardsLeft - result.yards;
  play.yardsLeft = nextYardsLeft;

  play.quarter = game.quarter;
  play.clockSecondsLeft = game.clockSecondsLeft;
  const achievedFirstDown = nextYardsLeft <= 0
    && result.outcome !== 'touchdown'
    && result.outcome !== 'interception'
    && result.outcome !== 'fumble';
  const outOfBounds = isOutOfBoundsResult(play.playType, play.result);
  const clockResult = applyClockEnabled
    ? applyPlayClock(clockState, {
      playType: play.playType,
      result: play.result,
      isFirstDown: achievedFirstDown,
      isOutOfBounds: outOfBounds,
      tempo,
    })
    : {
      clock: clockState,
      playSeconds: 0,
      halfEnded: false,
      gameEnded: false,
    };
  play.playSeconds = clockResult.playSeconds;
  game.quarter = clockResult.clock.quarter;
  game.clockSecondsLeft = clockResult.clock.secondsLeft;
  game.clockRunning = clockResult.clock.clockRunning;

  formatPlayText(play, offense, defense, starters);

  if (result.outcome === 'touchdown') {
    state.drive.result = 'touchdown';
    state.drive.points = 7;
    updateDriveScoreAfter(game, state.drive, offense);
    game.scoreA = state.drive.scoreAAfter;
    game.scoreB = state.drive.scoreBAfter;
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (result.outcome === 'interception') {
    state.drive.result = 'interception';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - nextFieldPosition,
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (result.outcome === 'fumble') {
    state.drive.result = 'fumble';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - nextFieldPosition,
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (nextFieldPosition < 1) {
    state.drive.result = 'safety';
    state.drive.points = 0;
    updateDriveScoreAfter(game, state.drive, offense);
    game.scoreA = state.drive.scoreAAfter;
    game.scoreB = state.drive.scoreBAfter;
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (down === 4 && nextYardsLeft > 0) {
    state.drive.result = 'turnover on downs';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - nextFieldPosition,
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }

  if (clockResult.halfEnded) {
    state.drive.result = 'end of half';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: false,
    };
  }
  if (clockResult.gameEnded) {
    state.drive.result = 'end of game';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: game.scoreA !== game.scoreB,
    };
  }

  let nextDown = down + 1;
  if (nextYardsLeft <= 0) {
    nextDown = 1;
    nextYardsLeft = startingYardsLeft(nextFieldPosition);
  }

  return {
    state: {
      ...state,
      fieldPosition: nextFieldPosition,
      down: nextDown,
      yardsLeft: nextYardsLeft,
    },
    play,
    driveComplete: false,
    nextFieldPosition: null,
    gameComplete: false,
  };
};

export const simGame = (
  league: LeagueState,
  game: SimGame,
  starters: StartersCache
) => {
  game.scoreA = 0;
  game.scoreB = 0;
  game.overtime = 0;
  const openingIsTeamA = isTeamAOpeningOffense(game);
  game.quarter = 1;
  game.clockSecondsLeft = SECONDS_PER_QUARTER;
  game.clockRunning = true;

  const drives: SimDrive[] = [];
  let fieldPosition = kickoffStartFieldPosition();
  let nextOffenseIsTeamA = openingIsTeamA;
  let driveNum = 0;

  while (true) {
    const offense = nextOffenseIsTeamA ? game.teamA : game.teamB;
    const defense = nextOffenseIsTeamA ? game.teamB : game.teamA;
    const lead = nextOffenseIsTeamA ? game.scoreA - game.scoreB : game.scoreB - game.scoreA;
    const prevQuarter = game.quarter;

    const driveResult = simDrive(
      {
        league,
        game,
        starters,
        offense,
        defense,
        lead,
        clockEnabled: true,
      },
      fieldPosition,
      driveNum
    );
    fieldPosition = driveResult.nextFieldPosition;

    game.scoreA = driveResult.record.scoreAAfter;
    game.scoreB = driveResult.record.scoreBAfter;
    drives.push(driveResult);
    driveNum += 1;

    const halftimeReached = prevQuarter === 2
      && game.quarter === 3
      && game.clockSecondsLeft === SECONDS_PER_QUARTER;
    if (game.quarter === 4 && game.clockSecondsLeft === 0) {
      break;
    }
    if (halftimeReached) {
      fieldPosition = kickoffStartFieldPosition();
      nextOffenseIsTeamA = !openingIsTeamA;
      continue;
    }
    nextOffenseIsTeamA = !nextOffenseIsTeamA;
  }

  if (game.scoreA === game.scoreB) {
    let driveNumOt = driveNum + 1;
    while (game.scoreA === game.scoreB) {
      game.overtime += 1;
      for (let possession = 0; possession < 2; possession += 1) {
        const isTeamA = possession === 0;
        const offense = isTeamA ? game.teamA : game.teamB;
        const defense = isTeamA ? game.teamB : game.teamA;
        const lead = isTeamA ? game.scoreA - game.scoreB : game.scoreB - game.scoreA;
        const driveResult = simDrive(
          {
            league,
            game,
            starters,
            offense,
            defense,
            lead,
            clockEnabled: false,
          },
          OT_START_YARD_LINE,
          driveNumOt
        );
        game.scoreA = driveResult.record.scoreAAfter;
        game.scoreB = driveResult.record.scoreBAfter;
        drives.push(driveResult);
        driveNumOt += 1;
        if (possession === 1 && game.scoreA !== game.scoreB) {
          break;
        }
      }
    }
  }

  if (game.scoreA > game.scoreB) {
    game.winner = game.teamA;
    game.resultA = 'W';
    game.resultB = 'L';
  } else {
    game.winner = game.teamB;
    game.resultA = 'L';
    game.resultB = 'W';
  }

  return drives;
};

export const finalizeGameResult = (game: SimGame) => {
  if (game.scoreA > game.scoreB) {
    game.winner = game.teamA;
    game.resultA = 'W';
    game.resultB = 'L';
  } else {
    game.winner = game.teamB;
    game.resultA = 'L';
    game.resultB = 'W';
  }
};

export const createGameLogsFromPlays = (
  league: LeagueState,
  game: SimGame,
  plays: PlayRecord[],
  starters: StartersCache
) => {
  const logs: GameLogRecord[] = [];
  const logByPlayerId = new Map<number, GameLogRecord>();
  const desiredPositions = ['qb', 'rb', 'wr', 'te', 'k', 'dl', 'lb', 'cb', 's'];

  const seedLogs = (team: Team) => {
    desiredPositions.forEach(pos => {
      const startersForPos = starters.byTeamPos.get(`${team.id}:${pos}`) ?? [];
      startersForPos.forEach(player => {
        if (logByPlayerId.has(player.id)) return;
        const log: GameLogRecord = {
          playerId: player.id,
          gameId: game.id,
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
        };
        logs.push(log);
        logByPlayerId.set(player.id, log);
      });
    });
  };

  seedLogs(game.teamA);
  seedLogs(game.teamB);

  const defendersByTeam = (team: Team) => {
    const defenders: PlayerRecord[] = [];
    ['dl', 'lb', 'cb', 's'].forEach(pos => {
      defenders.push(...(starters.byTeamPos.get(`${team.id}:${pos}`) ?? []));
    });
    return defenders;
  };

  const defenderCache = new Map<number, PlayerRecord[]>();
  defenderCache.set(game.teamA.id, defendersByTeam(game.teamA));
  defenderCache.set(game.teamB.id, defendersByTeam(game.teamB));

  const chooseWeighted = (players: PlayerRecord[], bias: Record<string, number>) => {
    if (!players.length) return null;
    const weighted = players.map(player => ({
      item: player,
      weight: (Math.max(player.rating, 0) + 5) * (bias[player.pos.toLowerCase()] ?? 1),
    }));
    return weightedChoice(weighted);
  };

  plays.forEach(play => {
    const offense = play.offenseId === game.teamA.id ? game.teamA : game.teamB;
    const defense = play.defenseId === game.teamA.id ? game.teamA : game.teamB;
    const rb = starters.byTeamPos.get(`${offense.id}:rb`) ?? [];
    const qb = starters.byTeamPos.get(`${offense.id}:qb`) ?? [];
    const wr = starters.byTeamPos.get(`${offense.id}:wr`) ?? [];
    const te = starters.byTeamPos.get(`${offense.id}:te`) ?? [];
    const k = starters.byTeamPos.get(`${offense.id}:k`) ?? [];
    const defenders = defenderCache.get(defense.id) ?? [];

    if (play.playType === 'run') {
      const runner = chooseWeighted(rb, { rb: 1.2 });
      if (runner) {
        const log = logByPlayerId.get(runner.id);
        if (log) {
          log.rush_attempts += 1;
          log.rush_yards += play.yardsGained;
          if (play.result === 'touchdown') log.rush_touchdowns += 1;
          if (play.result === 'fumble') log.fumbles += 1;
        }
      }
      const tackler = chooseWeighted(defenders, { dl: 1.2, lb: 1.1, cb: 0.8, s: 0.9 });
      if (tackler) {
        const log = logByPlayerId.get(tackler.id);
        if (log) log.tackles += 1;
      }
    } else if (play.playType === 'pass') {
      const qbPlayer = qb[0];
      if (qbPlayer) {
        const qbLog = logByPlayerId.get(qbPlayer.id);
        if (qbLog) qbLog.pass_attempts += 1;
      }
      if (play.result === 'sack') {
        const sackDef = chooseWeighted(defenders, { dl: 1.4, lb: 1.1 });
        if (sackDef) {
          const log = logByPlayerId.get(sackDef.id);
          if (log) log.sacks += 1;
        }
      } else if (play.result === 'interception') {
        if (qbPlayer) {
          const qbLog = logByPlayerId.get(qbPlayer.id);
          if (qbLog) qbLog.pass_interceptions += 1;
        }
        const interceptor = chooseWeighted(defenders, { cb: 1.3, s: 1.3, lb: 0.8 });
        if (interceptor) {
          const log = logByPlayerId.get(interceptor.id);
          if (log) log.interceptions += 1;
        }
      } else if (play.result === 'pass' || play.result === 'touchdown') {
        const receiver = chooseReceiver([...wr, ...te, ...rb]);
        if (qbPlayer) {
          const qbLog = logByPlayerId.get(qbPlayer.id);
          if (qbLog) {
            qbLog.pass_completions += 1;
            qbLog.pass_yards += play.yardsGained;
            if (play.result === 'touchdown') qbLog.pass_touchdowns += 1;
          }
        }
        if (receiver) {
          const recLog = logByPlayerId.get(receiver.id);
          if (recLog) {
            recLog.receiving_catches += 1;
            recLog.receiving_yards += play.yardsGained;
            if (play.result === 'touchdown') recLog.receiving_touchdowns += 1;
          }
        }
      }
    } else if (play.playType === 'field goal') {
      const kicker = chooseWeighted(k, { k: 1.2 });
      if (kicker) {
        const log = logByPlayerId.get(kicker.id);
        if (log) {
          log.field_goals_attempted += 1;
          if (play.result === 'made field goal') log.field_goals_made += 1;
        }
      }
    }
  });

  return logs;
};

export const buildStartersCacheFromPlayers = (players: PlayerRecord[]): StartersCache => {
  const byTeamPos = new Map<string, PlayerRecord[]>();
  players.filter(player => player.starter).forEach(player => {
    const key = `${player.teamId}:${player.pos}`;
    const list = byTeamPos.get(key) ?? [];
    list.push(player);
    byTeamPos.set(key, list);
  });
  return { byTeamPos };
};

export const buildStartersCache = async (teams: Team[]) => {
  const players: PlayerRecord[] = [];
  for (const team of teams) {
    players.push(...await getPlayersByTeam(team.id));
  }
  return buildStartersCacheFromPlayers(players);
};

export const loadPlayersMap = async (teams: Team[]) => {
  const map = new Map<number, PlayerRecord>();
  for (const team of teams) {
    const players = await getPlayersByTeam(team.id);
    players.forEach(player => map.set(player.id, player));
  }
  return map;
};

export const buildDriveResponse = (
  drives: DriveRecord[],
  plays: PlayRecord[],
  teamsById: Map<number, Team>
): Drive[] => {
  const playsByDrive = new Map<number, PlayRecord[]>();
  plays.forEach(play => {
    const list = playsByDrive.get(play.driveId) ?? [];
    list.push(play);
    playsByDrive.set(play.driveId, list);
  });

  return drives
    .sort((a, b) => a.driveNum - b.driveNum)
    .map(drive => {
      const offense = teamsById.get(drive.offenseId);
      const defense = teamsById.get(drive.defenseId);
      const drivePlays = (playsByDrive.get(drive.id) ?? [])
        .sort((a, b) => a.id - b.id)
        .map(play => ({
        id: play.id,
        driveId: play.driveId,
        down: play.down,
        yardsLeft: play.yardsLeft,
        startingFP: play.startingFP,
        playType: play.playType,
        yardsGained: play.yardsGained,
        text: play.text,
        header: play.header,
        result: play.result,
        scoreA: play.scoreA,
        scoreB: play.scoreB,
        quarter: play.quarter,
        clockSecondsLeft: play.clockSecondsLeft,
        playSeconds: play.playSeconds,
      }));
      const yards = drivePlays.reduce((sum, play) => sum + play.yardsGained, 0);
      return {
        driveNum: drive.driveNum,
        offense: offense?.name ?? '',
        defense: defense?.name ?? '',
        startingFP: drive.startingFP,
        result: drive.result,
        points: drive.points,
        scoreAAfter: drive.scoreAAfter,
        scoreBAfter: drive.scoreBAfter,
        plays: drivePlays,
        yards,
      };
    });
};

export const buildGameData = (
  game: GameRecord,
  teamsById: Map<number, Team>,
  story: import('../../types/news').GameNewsItem | null = null,
): GameData => {
  const teamA = teamsById.get(game.teamAId)!;
  const teamB = teamsById.get(game.teamBId)!;
  return {
    id: game.id,
    base_label: game.baseLabel,
    story,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    neutralSite: game.neutralSite,
    venue: game.venue,
    teamA: {
      id: teamA.id,
      name: teamA.name,
      record: teamA.record,
      colorPrimary: teamA.colorPrimary,
      colorSecondary: teamA.colorSecondary,
      mascot: teamA.mascot,
    },
    teamB: {
      id: teamB.id,
      name: teamB.name,
      record: teamB.record,
      colorPrimary: teamB.colorPrimary,
      colorSecondary: teamB.colorSecondary,
      mascot: teamB.mascot,
    },
    scoreA: game.scoreA ?? 0,
    scoreB: game.scoreB ?? 0,
  };
};

export const hydrateGame = (game: GameRecord, teamsById: Map<number, Team>): SimGame => ({
  id: game.id,
  teamA: teamsById.get(game.teamAId)!,
  teamB: teamsById.get(game.teamBId)!,
  homeTeam: game.homeTeamId ? teamsById.get(game.homeTeamId)! : null,
  awayTeam: game.awayTeamId ? teamsById.get(game.awayTeamId)! : null,
  neutralSite: game.neutralSite,
  venue: game.venue,
  winner: game.winnerId ? teamsById.get(game.winnerId)! : null,
  baseLabel: game.baseLabel,
  name: game.name,
  gameType: game.gameType,
  rivalryKey: game.rivalryKey,
  spreadA: game.spreadA,
  spreadB: game.spreadB,
  moneylineA: game.moneylineA,
  moneylineB: game.moneylineB,
  winProbA: game.winProbA,
  winProbB: game.winProbB,
  weekPlayed: game.weekPlayed,
  year: game.year,
  rankATOG: game.rankATOG,
  rankBTOG: game.rankBTOG,
  resultA: game.resultA,
  resultB: game.resultB,
  overtime: game.overtime,
  quarter: game.quarter ?? 1,
  clockSecondsLeft: game.clockSecondsLeft ?? SECONDS_PER_QUARTER,
  clockRunning: true,
  scoreA: game.scoreA ?? 0,
  scoreB: game.scoreB ?? 0,
  watchability: game.watchability,
});
