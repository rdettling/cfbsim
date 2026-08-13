import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { SimGame, SimDrive, StartersCache } from '../../types/sim';
import type { Drive, GameData } from '../../types/game';
import type { GameRecord, DriveRecord, PlayRecord } from '../../types/db';
import { SECONDS_PER_QUARTER } from './clock';
import { simDrive, simOvertimeShootoutDrive } from './drive';
import { kickoffStartFieldPosition } from './kickoffs';

export const OT_START_YARD_LINE = 75;

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
  game.clockRunning = false;
  game.timeoutsRemainingA = 3;
  game.timeoutsRemainingB = 3;

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
        overtimePossession: null,
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
        const overtimeContext = {
          league,
          game,
          starters,
          offense,
          defense,
          lead,
          clockEnabled: false,
          overtimePossession: possession as 0 | 1,
        };
        const driveResult = game.overtime >= 3
          ? simOvertimeShootoutDrive(overtimeContext, driveNumOt)
          : simDrive(overtimeContext, OT_START_YARD_LINE, driveNumOt);
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
        call: play.call,
        participants: play.participants,
        timing: play.timing,
      }));
      const yards = drivePlays.reduce(
        (sum, play) => sum + (play.call.kind === 'try' ? 0 : play.yardsGained),
        0,
      );
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
      ranking: game.rankATOG,
      record: teamA.record,
      colorPrimary: teamA.colorPrimary,
      colorSecondary: teamA.colorSecondary,
      mascot: teamA.mascot,
    },
    teamB: {
      id: teamB.id,
      name: teamB.name,
      ranking: game.rankBTOG,
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
  clockRunning: false,
  timeoutsRemainingA: 3,
  timeoutsRemainingB: 3,
  scoreA: game.scoreA ?? 0,
  scoreB: game.scoreB ?? 0,
  watchability: game.watchability,
});
