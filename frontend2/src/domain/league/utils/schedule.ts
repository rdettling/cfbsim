import type { ScheduleGame, Team } from '../../../types/domain';
import type { GameRecord } from '../../../types/db';

export const buildScheduleGameForTeam = (
  team: Team,
  game: GameRecord,
  teamsById: Map<number, Team>
): ScheduleGame => {
  const opponentId = game.teamAId === team.id ? game.teamBId : game.teamAId;
  const opponent = teamsById.get(opponentId);
  if (!opponent) {
    throw new Error('Opponent not found for schedule.');
  }

  const isTeamA = game.teamAId === team.id;
  const scoreA = game.scoreA ?? 0;
  const scoreB = game.scoreB ?? 0;
  const score = game.winnerId
    ? `${isTeamA ? scoreA : scoreB}-${isTeamA ? scoreB : scoreA}`
    : '';
  const location = game.neutralSite
    ? 'Neutral'
    : game.homeTeamId === team.id
      ? 'Home'
      : game.awayTeamId === team.id
        ? 'Away'
        : undefined;

  return {
    weekPlayed: game.weekPlayed,
    opponent: {
      name: opponent.name,
      rating: opponent.rating,
      ranking: opponent.ranking,
      record: opponent.record,
    },
    label: game.baseLabel,
    result: isTeamA ? game.resultA ?? '' : game.resultB ?? '',
    score,
    spread: isTeamA ? game.spreadA : game.spreadB,
    moneyline: isTeamA ? game.moneylineA : game.moneylineB,
    id: `${game.id}`,
    location,
  } as const;
};
