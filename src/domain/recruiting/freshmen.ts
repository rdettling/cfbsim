import type { PlayerOrigin, PlayerRecord } from '../../types/db';
import type { RecruitingProspect } from '../../types/recruiting';
import {
  buildPositionRanks,
  buildRecruitOrigin,
} from '../playerOrigins';

export interface BuildCommittedFreshmenInput {
  prospects: RecruitingProspect[];
  existingPlayers: PlayerRecord[];
  nextPlayerId: number | undefined;
  acquisitionYear: number;
}

export const buildCommittedFreshmen = ({
  prospects,
  existingPlayers,
  nextPlayerId,
  acquisitionYear,
}: BuildCommittedFreshmenInput) => {
  const highestExistingId = existingPlayers.reduce(
    (highest, player) => Math.max(highest, player.id),
    0,
  );
  let cursor = Math.max(nextPlayerId ?? 1, highestExistingId + 1);
  const positionRanks = buildPositionRanks(prospects);
  const origins: PlayerOrigin[] = [];
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
        starter: false,
      };
      origins.push(
        buildRecruitOrigin({
          playerId: player.id,
          prospect,
          acquisitionYear,
          positionRank: positionRanks.get(prospect.id)!,
        }),
      );
      cursor += 1;
      return player;
    });

  return { players, origins, nextPlayerId: cursor };
};
