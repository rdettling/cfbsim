import type { Info, PlayoffTeamCount, Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import type { LeagueState } from '../../types/league';
import type { GameRecord } from '../../types/db';
import type { OddsContext } from '../odds';
import { getWinProbForRatings, HOME_FIELD_ADVANTAGE } from '../odds';
import { BOWL_WEEK } from '../league/postseason';
import { REGULAR_SEASON_WEEKS } from '../schedule/constants';

type TeamRecordDelta = {
  team: Team;
  confWins: number;
  confLosses: number;
  nonConfWins: number;
  nonConfLosses: number;
  totalWins: number;
  totalLosses: number;
  strength: number;
  gamesPlayed: number;
};

const roundTo3 = (value: number) => Math.round(value * 1000) / 1000;

export const formatRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

const averageTeamRating = (teams: Team[]) =>
  teams.reduce((sum, team) => sum + team.rating, 0) / Math.max(1, teams.length);

const getRankingFreezeWeeks = (playoffTeams: PlayoffTeamCount) =>
  playoffTeams === 4
    ? [BOWL_WEEK]
    : playoffTeams === 12
      ? [BOWL_WEEK, BOWL_WEEK + 1, BOWL_WEEK + 2]
      : [];

const getInertiaWeight = (currentWeek: number) => {
  // Rankings run before currentWeek increments, so treat currentWeek as completed.
  const seasonWeeks = Math.max(1, REGULAR_SEASON_WEEKS);
  const completedWeeks = Math.min(seasonWeeks, Math.max(0, currentWeek));
  const remainingWeeks = Math.max(0, seasonWeeks - completedWeeks);
  return remainingWeeks / seasonWeeks;
};

const buildSorNormalizer = (teams: Team[]) => {
  const sorValues = teams.map(team => team.strength_of_record_avg);
  const minSor = sorValues.length ? Math.min(...sorValues) : 0;
  const maxSor = sorValues.length ? Math.max(...sorValues) : 0;
  const sorRange = maxSor - minSor;

  return (sor: number) => {
    if (sorRange <= 0) return 50;
    return ((sor - minSor) / sorRange) * 100;
  };
};

const sortByPollScore = (teams: Team[]) =>
  [...teams].sort((a, b) => {
    if (b.poll_score !== a.poll_score) return b.poll_score - a.poll_score;
    return (a.last_rank ?? a.ranking) - (b.last_rank ?? b.ranking);
  });

const applyRankBasedPollScores = (teams: Team[]) => {
  const teamCount = teams.length;
  const toScore = (rank: number) =>
    teamCount <= 1 ? 100 : ((teamCount - rank) / (teamCount - 1)) * 100;
  teams.forEach(team => {
    team.poll_score = roundTo3(toScore(team.ranking));
  });
};

const expectedWinForAverageTeam = (
  averageRating: number,
  opponent: Team,
  isHome: boolean,
  isNeutral: boolean,
  oddsContext: OddsContext
) => {
  let ratingA = averageRating;
  let ratingB = opponent.rating;
  if (!isNeutral) {
    if (isHome) ratingA += HOME_FIELD_ADVANTAGE;
    else ratingB += HOME_FIELD_ADVANTAGE;
  }
  return getWinProbForRatings(ratingA, ratingB, oddsContext);
};

export const updateTeamRecords = (
  games: SimGame[],
  teams: Team[],
  oddsContext: OddsContext,
) => {
  const updates = new Map<number, TeamRecordDelta>();

  const averageRating = averageTeamRating(teams);
  const getUpdate = (team: Team) => {
    const existing = updates.get(team.id);
    if (existing) return existing;
    const created = {
      team,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
      totalWins: 0,
      totalLosses: 0,
      strength: 0,
      gamesPlayed: 0,
    };
    updates.set(team.id, created);
    return created;
  };

  games.forEach(game => {
    if (!game.winner) return;

    const teamA = game.teamA;
    const teamB = game.teamB;
    const teamAUpdate = getUpdate(teamA);
    const teamBUpdate = getUpdate(teamB);

    teamAUpdate.gamesPlayed += 1;
    teamBUpdate.gamesPlayed += 1;

    const teamAWin = game.winner.id === teamA.id;
    const teamBWin = !teamAWin;

    if (teamAWin) {
      teamAUpdate.totalWins += 1;
      teamBUpdate.totalLosses += 1;
    } else {
      teamBUpdate.totalWins += 1;
      teamAUpdate.totalLosses += 1;
    }

    if (teamA.conference !== 'Independent' && teamA.conference === teamB.conference) {
      if (teamAWin) {
        teamAUpdate.confWins += 1;
        teamBUpdate.confLosses += 1;
      } else {
        teamBUpdate.confWins += 1;
        teamAUpdate.confLosses += 1;
      }
    } else {
      if (teamAWin) {
        teamAUpdate.nonConfWins += 1;
        teamBUpdate.nonConfLosses += 1;
      } else {
        teamBUpdate.nonConfWins += 1;
        teamAUpdate.nonConfLosses += 1;
      }
    }

    const isNeutral = game.neutralSite;
    const teamAHome = !!game.homeTeam && game.homeTeam.id === teamA.id;
    const teamBHome = !!game.homeTeam && game.homeTeam.id === teamB.id;

    const expectedA = expectedWinForAverageTeam(
      averageRating,
      teamB,
      teamAHome,
      isNeutral,
      oddsContext
    );
    const expectedB = expectedWinForAverageTeam(
      averageRating,
      teamA,
      teamBHome,
      isNeutral,
      oddsContext
    );

    teamAUpdate.strength += (teamAWin ? 1 : 0) - expectedA;
    teamBUpdate.strength += (teamBWin ? 1 : 0) - expectedB;
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
    team.strength_of_record_avg = team.strength_of_record / Math.max(1, team.gamesPlayed);
    team.record = formatRecord(team);
  });
};

export interface RankingUpdate {
  teamId: number;
  previousRank: number;
  currentRank: number;
  record: string;
  pollScore: number;
}

export const updateRankings = (
  info: Info,
  teams: Team[],
  settings: LeagueState['settings']
) => {
  const playoffTeams = settings.playoffTeams;
  const skipWeeks = getRankingFreezeWeeks(playoffTeams);
  if (skipWeeks.includes(info.currentWeek)) {
    return [];
  }

  const teamCount = teams.length;
  const toScore = (rank: number) =>
    teamCount <= 1 ? 100 : ((teamCount - rank) / (teamCount - 1)) * 100;
  const toSorScore = buildSorNormalizer(teams);
  const topSor = teams.reduce(
    (best, team) => Math.max(best, team.strength_of_record_avg),
    Number.NEGATIVE_INFINITY
  );
  const inertiaWeight = getInertiaWeight(info.currentWeek);

  teams.forEach(team => {
    const previousRank = team.ranking;
    team.last_rank = previousRank;
    const rankScore = toScore(previousRank);
    const sorScore = toSorScore(team.strength_of_record_avg);
    let pollScore = inertiaWeight * rankScore + (1 - inertiaWeight) * sorScore;
    const isBestSor = team.strength_of_record_avg === topSor;
    const canBePerfect = previousRank === 1 && isBestSor;
    if (!canBePerfect) {
      pollScore = Math.min(pollScore, 99.9);
    }
    team.poll_score = roundTo3(pollScore);
  });

  const sorted = sortByPollScore(teams);
  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
  return teams.map(team => ({
    teamId: team.id,
    previousRank: team.last_rank ?? team.ranking,
    currentRank: team.ranking,
    record: team.record,
    pollScore: team.poll_score,
  }));
};

export const finalizePostseasonRankings = (
  teams: Team[],
  natty: GameRecord | null
) => {
  teams.forEach(team => {
    team.poll_score = roundTo3(team.strength_of_record_avg);
  });

  const sorted = sortByPollScore(teams);

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
    applyRankBasedPollScores(teams);
    return;
  }

  sorted.forEach((team, index) => {
    team.ranking = index + 1;
  });
  applyRankBasedPollScores(teams);
};
