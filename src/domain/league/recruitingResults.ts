import type { PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type {
  RecruitingPlayerResult,
  RecruitingResults,
  RecruitingStarCounts,
  RecruitingTeamResult,
} from '../../types/recruiting';
import { POSITION_ORDER } from '../rosterConfig';

const QUALITY_FOCUS = 0.92;

const roundToOne = (value: number) => Math.round(value * 10) / 10;
const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const comparePlayers = (
  left: Omit<RecruitingPlayerResult, 'rank'>,
  right: Omit<RecruitingPlayerResult, 'rank'>,
) =>
  right.rating - left.rating ||
  right.stars - left.stars ||
  left.last.localeCompare(right.last) ||
  left.first.localeCompare(right.first) ||
  left.id - right.id;

const countStars = (
  players: RecruitingPlayerResult[],
): RecruitingStarCounts => ({
  five: players.filter(player => player.stars === 5).length,
  four: players.filter(player => player.stars === 4).length,
  three: players.filter(player => player.stars === 3).length,
  two: players.filter(player => player.stars === 2).length,
  one: players.filter(player => player.stars === 1).length,
});

type TeamCandidate = Omit<RecruitingTeamResult, 'rank' | 'classScore'> & {
  rawScore: number;
  totalRating: number;
};

export const buildRecruitingResults = (
  teams: Team[],
  players: PlayerRecord[],
  userTeamId: number,
): RecruitingResults => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const rankedPlayers = players
    .filter(
      player =>
        player.active &&
        player.year === 'fr' &&
        teamsById.has(player.teamId),
    )
    .map(player => {
      const team = teamsById.get(player.teamId)!;
      return {
        id: player.id,
        first: player.first,
        last: player.last,
        position: player.pos,
        rating: player.rating,
        stars: player.stars,
        teamId: team.id,
        teamName: team.name,
      };
    })
    .sort(comparePlayers)
    .map((player, index) => ({ ...player, rank: index + 1 }));

  const playersByTeam = new Map<number, RecruitingPlayerResult[]>();
  rankedPlayers.forEach(player => {
    const teamPlayers = playersByTeam.get(player.teamId) ?? [];
    teamPlayers.push(player);
    playersByTeam.set(player.teamId, teamPlayers);
  });

  const candidates: TeamCandidate[] = [];
  playersByTeam.forEach((recruits, teamId) => {
    const team = teamsById.get(teamId);
    if (!team) return;

    const totalRating = recruits.reduce(
      (sum, player) => sum + player.rating,
      0,
    );
    const totalStars = recruits.reduce(
      (sum, player) => sum + player.stars,
      0,
    );
    const averageStars = totalStars / recruits.length;
    const rawScore = roundToOne(
      QUALITY_FOCUS * averageStars +
        (1 - QUALITY_FOCUS) * recruits.length,
    );

    candidates.push({
      teamId,
      teamName: team.name,
      conference: team.confName ?? team.conference,
      prestige: team.prestige,
      recruits,
      totalRecruits: recruits.length,
      averageRating: roundToOne(totalRating / recruits.length),
      averageStars: roundToTwo(averageStars),
      starCounts: countStars(recruits),
      rawScore,
      totalRating,
    });
  });

  candidates.sort(
    (left, right) =>
      right.rawScore - left.rawScore ||
      right.totalRating - left.totalRating ||
      left.teamName.localeCompare(right.teamName),
  );

  const maxScore = candidates[0]?.rawScore ?? 0;
  const minScore = candidates[candidates.length - 1]?.rawScore ?? 0;
  const scoreRange = maxScore - minScore;
  const teamRankings: RecruitingTeamResult[] = candidates.map(
    ({ rawScore, totalRating: _totalRating, ...candidate }, index) => ({
      ...candidate,
      rank: index + 1,
      classScore: roundToOne(
        scoreRange > 0
          ? ((rawScore - minScore) / scoreRange) * 100
          : 100,
      ),
    }),
  );

  const positionSet = new Set(
    rankedPlayers.map(player => player.position),
  );
  const positions = [
    ...POSITION_ORDER.filter(position => positionSet.has(position)),
    ...Array.from(positionSet)
      .filter(position => !POSITION_ORDER.includes(position))
      .sort((left, right) => left.localeCompare(right)),
  ];

  return {
    teamRankings,
    playerRankings: rankedPlayers,
    positions,
    userTeam:
      teamRankings.find(team => team.teamId === userTeamId) ?? null,
    summary: {
      totalRecruits: rankedPlayers.length,
      averageRating: rankedPlayers.length
        ? roundToOne(
            rankedPlayers.reduce(
              (sum, player) => sum + player.rating,
              0,
            ) / rankedPlayers.length,
          )
        : 0,
      highestRating: rankedPlayers[0]?.rating ?? 0,
    },
  };
};
