import type { Play, Drive } from '../../types/game';
import type { PlayRecord, DriveRecord } from '../../types/db';
import type { Team } from '../../types/domain';

export const mapPlayRecord = (play: PlayRecord): Play => ({
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
});

export const buildDriveUi = (
  driveRecord: DriveRecord,
  teamsById: Map<number, Team>
): Drive => {
  const offense = teamsById.get(driveRecord.offenseId);
  const defense = teamsById.get(driveRecord.defenseId);
  return {
    driveNum: driveRecord.driveNum,
    offense: offense?.name ?? '',
    defense: defense?.name ?? '',
    startingFP: driveRecord.startingFP,
    result: driveRecord.result,
    points: driveRecord.points,
    scoreAAfter: driveRecord.scoreAAfter,
    scoreBAfter: driveRecord.scoreBAfter,
    plays: [],
    yards: 0,
  };
};

export const buildNextHeader = (fieldPosition: number, down: number, yardsLeft: number) => {
  const location = fieldPosition <= 50 ? 'OWN' : 'OPP';
  const yardLine = fieldPosition <= 50 ? fieldPosition : 100 - fieldPosition;
  const downSuffix = down === 1 ? 'st' : down === 2 ? 'nd' : down === 3 ? 'rd' : 'th';
  return `${down}${downSuffix} & ${yardsLeft} at ${location} ${yardLine}`;
};

export const resolveDecision = (decision: string) => {
  if (decision === 'field_goal') return 'field_goal';
  if (decision === 'punt') return 'punt';
  if (decision === 'pass') return 'pass';
  return 'run';
};
