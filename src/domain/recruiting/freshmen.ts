import type { PlayerRecord } from '../../types/db';
import type { RecruitingProspect } from '../../types/recruiting';

export interface BuildCommittedFreshmenInput {
  prospects: RecruitingProspect[];
  existingPlayers: PlayerRecord[];
  nextPlayerId: number | undefined;
}

export const buildCommittedFreshmen = ({
  prospects,
  existingPlayers,
  nextPlayerId,
}: BuildCommittedFreshmenInput) => {
  const highestExistingId = existingPlayers.reduce(
    (highest, player) => Math.max(highest, player.id),
    0,
  );
  let cursor = Math.max(nextPlayerId ?? 1, highestExistingId + 1);
  const players = prospects
    .filter(
      (prospect): prospect is RecruitingProspect & { committedTeamId: number } =>
        prospect.committedTeamId !== null,
    )
    .sort(
      (left, right) =>
        left.nationalRank - right.nationalRank || left.id - right.id,
    )
    .map<PlayerRecord>(prospect => {
      const player: PlayerRecord = {
        id: cursor,
        teamId: prospect.committedTeamId,
        first: prospect.first,
        last: prospect.last,
        year: 'fr',
        pos: prospect.position,
        rating: prospect.ratingFr,
        rating_fr: prospect.ratingFr,
        rating_so: prospect.ratingSo,
        rating_jr: prospect.ratingJr,
        rating_sr: prospect.ratingSr,
        stars: prospect.stars,
        development_trait: prospect.developmentTrait,
        starter: false,
        active: true,
      };
      cursor += 1;
      return player;
    });

  return { players, nextPlayerId: cursor };
};
