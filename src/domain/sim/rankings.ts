import type { Info, Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import type { LeagueState } from '../../types/league';
import { DEFAULT_SETTINGS } from '../../types/league';

const WIN_FACTOR = 1.5;
const LOSS_FACTOR = 1.08;

const POLL_INERTIA_WIN_BONUS = 172;
const POLL_INERTIA_LOSS_PENALTY = 157;
const RANKING_TOTAL_WEEKS = 14;

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

    const winnerResumeAdd = loser.rating ** WIN_FACTOR;
    const loserResumeAdd = winner.rating ** LOSS_FACTOR;
    winnerUpdate.strength += winnerResumeAdd;
    loserUpdate.strength += loserResumeAdd;
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
    if (info.currentWeek === info.lastWeek) {
      team.poll_score = Math.round(baseScore * 10) / 10;
    } else {
      const weeksLeft = Math.max(0, RANKING_TOTAL_WEEKS - info.currentWeek);
      const inertiaScale = weeksLeft / RANKING_TOTAL_WEEKS;
      const teamGame = teamGames.get(team.id);
      const inertiaFactor = teamGame && teamGame.winner?.id === team.id
        ? POLL_INERTIA_WIN_BONUS
        : POLL_INERTIA_LOSS_PENALTY;
      const inertiaValue = Math.max(0, inertiaFactor * (teams.length - team.ranking) * inertiaScale);
      team.poll_score = Math.round((baseScore + inertiaValue) * 10) / 10;
    }
  });

  const sorted = [...teams].sort((a, b) => {
    if (b.poll_score !== a.poll_score) return b.poll_score - a.poll_score;
    return (a.last_rank ?? a.ranking) - (b.last_rank ?? b.ranking);
  });
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
};
