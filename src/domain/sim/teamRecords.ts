import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import {
  getWinProbForRatings,
  HOME_FIELD_ADVANTAGE,
  type OddsContext,
} from '../odds';

type TeamRecordDelta = {
  team: Team;
  confWins: number;
  confLosses: number;
  nonConfWins: number;
  nonConfLosses: number;
  totalWins: number;
  totalLosses: number;
  winsOverExpectation: number;
  gamesPlayed: number;
};

export const formatRecord = (team: Team) =>
  `${team.totalWins}-${team.totalLosses} (${team.confWins}-${team.confLosses})`;

const averageTeamRating = (teams: Team[]) =>
  teams.reduce((sum, team) => sum + team.rating, 0) / Math.max(1, teams.length);

const expectedWinForAverageTeam = (
  averageRating: number,
  opponent: Team,
  isHome: boolean,
  isNeutral: boolean,
  oddsContext: OddsContext,
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
    const created: TeamRecordDelta = {
      team,
      confWins: 0,
      confLosses: 0,
      nonConfWins: 0,
      nonConfLosses: 0,
      totalWins: 0,
      totalLosses: 0,
      winsOverExpectation: 0,
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

    const isRegularSeason = game.gameType === 'regular_season';
    if (
      isRegularSeason &&
      teamA.conference !== 'Independent' &&
      teamA.conference === teamB.conference
    ) {
      if (teamAWin) {
        teamAUpdate.confWins += 1;
        teamBUpdate.confLosses += 1;
      } else {
        teamBUpdate.confWins += 1;
        teamAUpdate.confLosses += 1;
      }
    } else if (isRegularSeason) {
      if (teamAWin) {
        teamAUpdate.nonConfWins += 1;
        teamBUpdate.nonConfLosses += 1;
      } else {
        teamBUpdate.nonConfWins += 1;
        teamAUpdate.nonConfLosses += 1;
      }
    }

    const isNeutral = game.neutralSite;
    const teamAHome = game.homeTeam?.id === teamA.id;
    const teamBHome = game.homeTeam?.id === teamB.id;
    const expectedA = expectedWinForAverageTeam(
      averageRating,
      teamB,
      teamAHome,
      isNeutral,
      oddsContext,
    );
    const expectedB = expectedWinForAverageTeam(
      averageRating,
      teamA,
      teamBHome,
      isNeutral,
      oddsContext,
    );

    teamAUpdate.winsOverExpectation += (teamAWin ? 1 : 0) - expectedA;
    teamBUpdate.winsOverExpectation += (teamBWin ? 1 : 0) - expectedB;
  });

  updates.forEach(update => {
    const team = update.team;
    team.confWins += update.confWins;
    team.confLosses += update.confLosses;
    team.nonConfWins += update.nonConfWins;
    team.nonConfLosses += update.nonConfLosses;
    team.totalWins += update.totalWins;
    team.totalLosses += update.totalLosses;
    team.wins_over_expectation += update.winsOverExpectation;
    team.gamesPlayed += update.gamesPlayed;
    team.wins_over_expectation_per_game =
      team.wins_over_expectation / Math.max(1, team.gamesPlayed);
    team.record = formatRecord(team);
  });
};
