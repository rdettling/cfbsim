import type { Info, Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import type { LeagueState } from '../../types/league';
import type { GameRecord } from '../../types/db';
import { DEFAULT_SETTINGS } from '../../types/league';

const RANKING_TOTAL_WEEKS = 14;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

export const updateTeamRecords = (games: SimGame[]) => {
  const updates = new Map<number, {
    team: Team;
    confWins: number;
    confLosses: number;
    nonConfWins: number;
    nonConfLosses: number;
    totalWins: number;
    totalLosses: number;
    strength: number;
    gamesPlayed: number;
  }>();

  games.forEach(game => {
    if (!game.winner) return;
    const winner = game.winner;
    const loser = winner.id === game.teamA.id ? game.teamB : game.teamA;

    const winnerUpdate = updates.get(winner.id) ?? {
      team: winner,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
      totalWins: 0,
      totalLosses: 0,
      strength: 0,
      gamesPlayed: 0,
    };
    const loserUpdate = updates.get(loser.id) ?? {
      team: loser,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
      totalWins: 0,
      totalLosses: 0,
      strength: 0,
      gamesPlayed: 0,
    };

    updates.set(winner.id, winnerUpdate);
    updates.set(loser.id, loserUpdate);

    winnerUpdate.gamesPlayed += 1;
    loserUpdate.gamesPlayed += 1;

    if (winner.conference !== 'Independent' && winner.conference === loser.conference) {
      winnerUpdate.confWins += 1;
      loserUpdate.confLosses += 1;
    } else {
      winnerUpdate.nonConfWins += 1;
      loserUpdate.nonConfLosses += 1;
    }

    winnerUpdate.totalWins += 1;
    loserUpdate.totalLosses += 1;

    winnerUpdate.strength += loser.rating;
    loserUpdate.strength += winner.rating;
  });

  updates.forEach(update => {
    const team = update.team;
    team.confWins += update.confWins;
    team.confLosses += update.confLosses;
    team.nonConfWins += update.nonConfWins;
    team.nonConfLosses += update.nonConfLosses;
    team.totalWins += update.totalWins;
    team.totalLosses += update.totalLosses;
    team.strength_of_record += update.strength;
    team.gamesPlayed += update.gamesPlayed;
    team.record = formatRecord(team);
  });
};

export const updateRankings = (
  info: Info,
  teams: Team[],
  weekGames: SimGame[],
  settings?: LeagueState['settings']
) => {
  const playoffTeams = settings?.playoff_teams ?? DEFAULT_SETTINGS.playoff_teams;
  const skipWeeks =
    playoffTeams === 4
      ? [16]
      : playoffTeams === 12
        ? [16, 17, 18]
        : [];
  if (skipWeeks.includes(info.currentWeek)) {
    return;
  }

  const teamGames = new Map<number, SimGame>();
  weekGames.forEach(game => {
    teamGames.set(game.teamA.id, game);
    teamGames.set(game.teamB.id, game);
  });

  teams.forEach(team => {
    team.last_rank = team.ranking;
    const gamesPlayed = team.totalWins + team.totalLosses;
    const baseScore = team.strength_of_record / Math.max(1, gamesPlayed);
    const lastRegularWeek = Math.min(info.lastWeek ?? RANKING_TOTAL_WEEKS, RANKING_TOTAL_WEEKS);
    const inertiaWeight = clamp((lastRegularWeek - info.currentWeek) / Math.max(1, lastRegularWeek - 1), 0, 1);
    const pollScore = inertiaWeight * team.poll_score + (1 - inertiaWeight) * baseScore;
    team.poll_score = Math.round(pollScore * 10) / 10;
  });

  const sorted = [...teams].sort((a, b) => {
    if (b.poll_score !== a.poll_score) return b.poll_score - a.poll_score;
    return (a.last_rank ?? a.ranking) - (b.last_rank ?? b.ranking);
  });
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
};

export const finalizePostseasonRankings = (
  teams: Team[],
  natty: GameRecord | null
) => {
  teams.forEach(team => {
    const gamesPlayed = team.totalWins + team.totalLosses;
    const baseScore = team.strength_of_record / Math.max(1, gamesPlayed);
    team.poll_score = Math.round(baseScore * 10) / 10;
  });

  const sorted = [...teams].sort((a, b) => {
    if (b.poll_score !== a.poll_score) return b.poll_score - a.poll_score;
    return (a.last_rank ?? a.ranking) - (b.last_rank ?? b.ranking);
  });

  if (natty?.winnerId && natty.teamAId && natty.teamBId) {
    const winnerId = natty.winnerId;
    const loserId = natty.teamAId === winnerId ? natty.teamBId : natty.teamAId;
    const champ = teams.find(team => team.id === winnerId) ?? null;
    const runnerUp = teams.find(team => team.id === loserId) ?? null;
    const rest = sorted.filter(team => team.id !== winnerId && team.id !== loserId);
    const ordered = [champ, runnerUp].filter(Boolean) as Team[];
    ordered.push(...rest);
    ordered.forEach((team, index) => {
      team.ranking = index + 1;
    });
    return;
  }

  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
};
