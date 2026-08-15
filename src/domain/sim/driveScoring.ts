import type { DriveRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';

export const updateDriveScoreAfter = (
  game: SimGame,
  drive: DriveRecord,
  offense: Team,
) => {
  if (drive.result !== 'safety') {
    if (offense.id === game.teamA.id) drive.scoreAAfter += drive.points;
    else drive.scoreBAfter += drive.points;
  } else if (offense.id === game.teamA.id) {
    drive.scoreBAfter += 2;
  } else {
    drive.scoreAAfter += 2;
  }
};

export const addOffensePoints = (
  game: SimGame,
  drive: DriveRecord,
  offense: Team,
  points: number,
) => {
  drive.points += points;
  if (offense.id === game.teamA.id) game.scoreA += points;
  else game.scoreB += points;
  drive.scoreAAfter = game.scoreA;
  drive.scoreBAfter = game.scoreB;
};
