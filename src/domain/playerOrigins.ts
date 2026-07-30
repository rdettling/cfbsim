import type { PlayerOrigin, PlayerRecord } from '../types/db';
import type { RecruitingProspect } from '../types/recruiting';

export const buildPositionRanks = (prospects: RecruitingProspect[]) => {
  const ranks = new Map<number, number>();
  const positionCounts = new Map<string, number>();
  [...prospects]
    .sort(
      (left, right) =>
        left.nationalRank - right.nationalRank || left.id - right.id,
    )
    .forEach(prospect => {
      const rank = (positionCounts.get(prospect.position) ?? 0) + 1;
      positionCounts.set(prospect.position, rank);
      ranks.set(prospect.id, rank);
    });
  return ranks;
};

export const buildRecruitOrigin = ({
  playerId,
  prospect,
  acquisitionYear,
  positionRank,
}: {
  playerId: number;
  prospect: RecruitingProspect & { committedTeamId: number };
  acquisitionYear: number;
  positionRank: number;
}): PlayerOrigin => {
  if (prospect.committedRound === null) {
    throw new Error(`Committed prospect ${prospect.id} has no commitment round.`);
  }
  return {
    playerId,
    kind: 'recruit',
    acquisitionYear,
    originalTeamId: prospect.committedTeamId,
    homeState: prospect.state,
    nationalRank: prospect.nationalRank,
    positionRank,
    commitmentRound: prospect.committedRound,
    publicRatingMin: prospect.publicRatingMin,
    publicRatingMax: prospect.publicRatingMax,
  };
};

export const buildWalkOnOrigins = (
  players: PlayerRecord[],
  acquisitionYear: number,
): PlayerOrigin[] =>
  players.map(player => ({
    playerId: player.id,
    kind: 'walk_on',
    acquisitionYear,
    originalTeamId: player.teamId,
  }));

export const buildInitialRosterOrigins = (
  players: PlayerRecord[],
  startYear: number,
): PlayerOrigin[] =>
  players.map(player => ({
    playerId: player.id,
    kind: 'initial_roster',
    acquisitionYear: startYear,
    originalTeamId: player.teamId,
    classAtStart: player.year,
  }));
