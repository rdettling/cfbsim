import type { Team } from '../../types/domain';
import type {
  RecruitingPlayerResult,
  RecruitingProspect,
  RecruitingResults,
  RecruitingStarCounts,
  RecruitingTeamResult,
} from '../../types/recruiting';
import { POSITION_ORDER } from '../rosterConfig';
import {
  calculateRecruitingClassScore,
  displayRecruitingClassScore,
} from '../recruiting/classScoring';

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const comparePlayers = (
  left: RecruitingPlayerResult,
  right: RecruitingPlayerResult,
) =>
  left.rank - right.rank ||
  left.prospectId - right.prospectId;

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
};

export const buildRecruitingResults = (
  teams: Team[],
  prospects: RecruitingProspect[],
  userTeamId: number,
): RecruitingResults => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const rankedPlayers = prospects
    .filter(
      prospect =>
        prospect.committedTeamId !== null &&
        teamsById.has(prospect.committedTeamId),
    )
    .map(prospect => {
      const team = teamsById.get(prospect.committedTeamId!)!;
      return {
        rank: prospect.nationalRank,
        prospectId: prospect.id,
        first: prospect.first,
        last: prospect.last,
        position: prospect.position,
        stars: prospect.stars,
        teamId: team.id,
        teamName: team.name,
      };
    })
    .sort(comparePlayers);

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

    const totalStars = recruits.reduce(
      (sum, player) => sum + player.stars,
      0,
    );
    const averageStars = totalStars / recruits.length;
    const rawScore = calculateRecruitingClassScore(recruits);

    candidates.push({
      teamId,
      teamName: team.name,
      conference: team.confName ?? team.conference,
      prestige: team.prestige,
      recruits,
      totalRecruits: recruits.length,
      averageStars: roundToTwo(averageStars),
      starCounts: countStars(recruits),
      rawScore,
    });
  });

  candidates.sort(
    (left, right) =>
      right.rawScore - left.rawScore ||
      left.teamName.localeCompare(right.teamName),
  );

  const teamRankings: RecruitingTeamResult[] = candidates.map(
    ({ rawScore, ...candidate }, index) => ({
      ...candidate,
      rank: index + 1,
      classScore: displayRecruitingClassScore(rawScore),
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
    },
  };
};
