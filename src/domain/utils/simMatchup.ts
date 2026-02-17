import { resolveHomeAway } from './gameDisplay';

type SimTeam = {
  id: number;
  name: string;
  record: string;
  mascot?: string;
  colorPrimary?: string;
  colorSecondary?: string;
};

type SimGameSource = {
  teamA: SimTeam;
  teamB: SimTeam;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
};

type SimMatchup = {
  homeTeam: SimTeam;
  awayTeam: SimTeam;
  homeScore: number;
  awayScore: number;
  currentScoreA: number;
  currentScoreB: number;
  awayIsTeamA: boolean;
  isAwayOnOffense: boolean;
  currentDriveNum: number;
  quarter: number;
  clockSecondsLeft: number;
  inOvertime: boolean;
  overtimeCount: number;
};

export const buildSimMatchup = (
  game: SimGameSource,
  scores: { scoreA: number; scoreB: number },
  isTeamAOnOffense: boolean,
  currentDriveNum: number,
  clock?: { quarter: number; clockSecondsLeft: number; inOvertime?: boolean; overtimeCount?: number }
): SimMatchup => {
  const { home, away } = resolveHomeAway({
    teamA: game.teamA,
    teamB: game.teamB,
    homeTeamId: game.homeTeamId ?? null,
    awayTeamId: game.awayTeamId ?? null,
  });

  const awayIsTeamA = away.id === game.teamA.id;
  const awayScore = awayIsTeamA ? scores.scoreA : scores.scoreB;
  const homeScore = awayIsTeamA ? scores.scoreB : scores.scoreA;
  const isAwayOnOffense = awayIsTeamA ? isTeamAOnOffense : !isTeamAOnOffense;
  const quarter = clock?.quarter ?? 1;
  const clockSecondsLeft = clock?.clockSecondsLeft ?? 900;
  const inOvertime = clock?.inOvertime ?? false;
  const overtimeCount = clock?.overtimeCount ?? 0;

  return {
    homeTeam: home,
    awayTeam: away,
    homeScore,
    awayScore,
    currentScoreA: scores.scoreA,
    currentScoreB: scores.scoreB,
    awayIsTeamA,
    isAwayOnOffense,
    currentDriveNum,
    quarter,
    clockSecondsLeft,
    inOvertime,
    overtimeCount,
  };
};
