import type { Team } from '../../../types/domain';

export const sortStandingsTeams = (teams: Team[]) =>
  teams.slice().sort((left, right) => {
    const leftGames = left.confWins + left.confLosses;
    const rightGames = right.confWins + right.confLosses;
    const leftPct = leftGames ? left.confWins / leftGames : 0;
    const rightPct = rightGames ? right.confWins / rightGames : 0;
    if (rightPct !== leftPct) return rightPct - leftPct;
    if (right.confWins !== left.confWins) return right.confWins - left.confWins;
    if (left.confLosses !== right.confLosses) return left.confLosses - right.confLosses;
    if (right.totalWins !== left.totalWins) return right.totalWins - left.totalWins;
    if (left.totalLosses !== right.totalLosses) return left.totalLosses - right.totalLosses;
    return left.ranking - right.ranking;
  });
