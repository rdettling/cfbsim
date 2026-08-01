import type { GameRecord } from '../../types/db';
import type { ScheduleGame, Team } from '../../types/domain';

export type OpponentEligibilityFailure =
  | 'invalid_week'
  | 'occupied_week'
  | 'same_team'
  | 'duplicate_opponent'
  | 'opponent_busy'
  | 'same_conference'
  | 'user_capacity'
  | 'opponent_capacity';

export type OpponentEligibility =
  | { eligible: true }
  | { eligible: false; reason: OpponentEligibilityFailure };

export const getOpponentEligibility = (
  schedule: ScheduleGame[],
  userTeam: Team,
  opponent: Team,
  week: number,
  existingGames: GameRecord[],
): OpponentEligibility => {
  if (!Number.isInteger(week) || week < 1 || week > schedule.length) {
    return { eligible: false, reason: 'invalid_week' };
  }
  if (schedule[week - 1]?.opponent) {
    return { eligible: false, reason: 'occupied_week' };
  }
  if (opponent.id === userTeam.id) {
    return { eligible: false, reason: 'same_team' };
  }
  if (
    existingGames.some(
      game =>
        (game.teamAId === userTeam.id && game.teamBId === opponent.id) ||
        (game.teamAId === opponent.id && game.teamBId === userTeam.id),
    )
  ) {
    return { eligible: false, reason: 'duplicate_opponent' };
  }
  if (
    existingGames.some(
      game =>
        game.weekPlayed === week &&
        (game.teamAId === opponent.id || game.teamBId === opponent.id),
    )
  ) {
    return { eligible: false, reason: 'opponent_busy' };
  }
  if (opponent.conference === userTeam.conference) {
    return { eligible: false, reason: 'same_conference' };
  }
  if (userTeam.nonConfGames >= userTeam.nonConfLimit) {
    return { eligible: false, reason: 'user_capacity' };
  }
  if (opponent.nonConfGames >= opponent.nonConfLimit) {
    return { eligible: false, reason: 'opponent_capacity' };
  }
  return { eligible: true };
};

export const listEligibleNonConferenceOpponents = (
  schedule: ScheduleGame[],
  userTeam: Team,
  teams: Team[],
  week: number,
  existingGames: GameRecord[],
): string[] =>
  teams
    .filter(
      opponent =>
        getOpponentEligibility(
          schedule,
          userTeam,
          opponent,
          week,
          existingGames,
        ).eligible,
    )
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(team => team.name);
