import type { GameRecord } from '../../types/db';
import type {
  ScheduleGame,
  Team,
} from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import { REGULAR_SEASON_WEEKS } from './constants';

export const buildSchedule = (weeks = REGULAR_SEASON_WEEKS): ScheduleGame[] =>
  Array.from({ length: weeks }, (_, index) => ({
    weekPlayed: index + 1,
    opponent: null,
    result: '',
    score: '',
    spread: '',
    moneyline: '',
    id: '',
    venue: null,
  }));

export const buildScheduleLabel = (userTeam: Team, opponent: Team) => {
  if (
    userTeam.conference !== 'Independent' &&
    userTeam.conference === opponent.conference
  ) {
    return `C (${userTeam.conference})`;
  }
  return opponent.conference ? `NC (${opponent.conference})` : 'NC (Ind)';
};

export const buildUserScheduleFromGames = (
  userTeam: Team,
  teams: Team[],
  games: GameRecord[],
  weeks = REGULAR_SEASON_WEEKS,
): ScheduleGame[] => {
  const schedule = buildSchedule(weeks);
  const teamsById = new Map(teams.map(team => [team.id, team]));

  games.forEach(game => {
    if (!game.weekPlayed || game.weekPlayed < 1 || game.weekPlayed > weeks) return;
    if (game.teamAId !== userTeam.id && game.teamBId !== userTeam.id) return;
    const slot = schedule[game.weekPlayed - 1];
    if (!slot) return;
    const opponentId = game.teamAId === userTeam.id ? game.teamBId : game.teamAId;
    const opponent = teamsById.get(opponentId);
    if (!opponent) return;
    const isTeamA = game.teamAId === userTeam.id;
    if (game.winnerId) {
      const userScore = isTeamA ? game.scoreA ?? 0 : game.scoreB ?? 0;
      const opponentScore = isTeamA ? game.scoreB ?? 0 : game.scoreA ?? 0;
      slot.score = `${userScore}-${opponentScore}`;
      slot.result = game.winnerId === userTeam.id ? 'W' : 'L';
    }
    slot.spread = isTeamA ? game.spreadA : game.spreadB;
    slot.moneyline = isTeamA ? game.moneylineA : game.moneylineB;
    slot.opponent = {
      name: opponent.name,
      rating: opponent.rating,
      ranking: opponent.ranking,
      record: opponent.record,
    };
    slot.label =
      game.name ?? game.baseLabel ?? buildScheduleLabel(userTeam, opponent);
    slot.location = game.neutralSite
      ? 'Neutral'
      : game.homeTeamId === userTeam.id
        ? 'Home'
        : game.awayTeamId === userTeam.id
          ? 'Away'
          : undefined;
    slot.venue = game.venue;
    slot.id = `${game.id}`;
  });

  return schedule;
};

export const projectFullGamesToUserSchedule = (
  schedule: ScheduleGame[],
  userTeam: Team,
  games: readonly FullGame[],
) => {
  const existingLabelsByWeek = new Map<number, string | undefined>();
  const existingIdsByWeek = new Map<number, string | undefined>();
  schedule.forEach(slot => {
    existingLabelsByWeek.set(slot.weekPlayed, slot.label);
    existingIdsByWeek.set(slot.weekPlayed, slot.id);
    slot.opponent = null;
    slot.label = undefined;
    slot.location = undefined;
    slot.venue = null;
    slot.id = '';
  });

  games.forEach(game => {
    if (
      game.weekPlayed <= 0 ||
      (game.teamA.id !== userTeam.id && game.teamB.id !== userTeam.id)
    ) return;
    const slot = schedule[game.weekPlayed - 1];
    if (!slot) return;

    const opponent = game.teamA.id === userTeam.id ? game.teamB : game.teamA;
    slot.opponent = {
      name: opponent.name,
      rating: opponent.rating,
      ranking: opponent.ranking,
      record: opponent.record,
    };
    slot.label = existingLabelsByWeek.get(game.weekPlayed) ??
      game.name ??
      buildScheduleLabel(userTeam, opponent);
    slot.location = game.homeTeam?.id === userTeam.id
      ? 'Home'
      : game.awayTeam?.id === userTeam.id
        ? 'Away'
        : 'Neutral';
    slot.venue = game.venue;
    const existingId = existingIdsByWeek.get(game.weekPlayed);
    slot.id = existingId && existingId.length
      ? existingId
      : `${game.teamA.name}-vs-${game.teamB.name}-week-${game.weekPlayed}`;
  });
};
