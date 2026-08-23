import {
  FINAL_ROSTER_SIZE,
  MAX_ROSTER_SIZE,
  ROSTER_OVERSIGN_ALLOWANCE,
} from '../rosterConfig';

export const RECRUITING = {
  rounds: 6,
  boardLimit: 25,
  initialContenders: 10,
  meaningfulPursuitPoints: 20,
  commitmentThreshold: 55,
  commitmentLead: 10,
  rosterSize: FINAL_ROSTER_SIZE,
  maxRosterSize: MAX_ROSTER_SIZE,
  oversignAllowance: ROSTER_OVERSIGN_ALLOWANCE,
  ratingRangeWidth: 10,
} as const;

export const AI_RECRUITING = {
  publicValueStarsWeight: 0.9,
  publicValueRankWeight: 0.1,
  scoreValueWeight: 0.35,
  scoreFitWeight: 0.3,
  scoreNeedWeight: 0.25,
  scoreCompetitionWeight: 0.1,
  starterShortageNeed: 100,
  softDeficitNeed: 70,
  otherNeed: 20,
  targetOversignings: 2,
} as const;

export type RecruitStarCounts = Readonly<Record<number, number>>;

export const RECRUIT_STAR_COUNTS: RecruitStarCounts = {
  5: 32,
  4: 340,
  3: 2800,
  2: 200,
};

export const STAR_FRESHMAN_RATING_ESTIMATES: Readonly<Record<number, number>> = {
  1: 30,
  2: 30,
  3: 50,
  4: 67,
  5: 79,
};
