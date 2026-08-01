import type { GameRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type { FullGame } from '../../types/scheduleTypes';
import {
  isConferenceGame,
  resetTeamScheduleCounts,
  stableNumber,
} from './planner';

const REGULAR_SEASON_GAMES = 12;

export const preservesScheduleCapacityWithOpponent = ({
  teams,
  userTeamId,
  opponentId,
  week,
  existingGames,
  year,
  requiredGames = [],
}: {
  teams: Team[];
  userTeamId: number;
  opponentId: number;
  week: number;
  existingGames: GameRecord[];
  year: number;
  requiredGames?: FullGame[];
}) => {
  const cloned = structuredClone(teams);
  const byId = new Map(cloned.map(team => [team.id, team]));
  const userTeam = byId.get(userTeamId);
  const opponent = byId.get(opponentId);
  if (!userTeam || !opponent) return false;
  resetTeamScheduleCounts(cloned);
  const opponentsByTeam = new Map<number, Set<number>>(
    cloned.map(team => [team.id, new Set<number>()]),
  );
  const weeksByTeam = new Map<number, Set<number>>(
    cloned.map(team => [team.id, new Set<number>()]),
  );
  const register = (teamA: Team, teamB: Team, gameWeek: number) => {
    if (
      opponentsByTeam.get(teamA.id)?.has(teamB.id) ||
      (gameWeek > 0 && weeksByTeam.get(teamA.id)?.has(gameWeek)) ||
      (gameWeek > 0 && weeksByTeam.get(teamB.id)?.has(gameWeek))
    ) return false;
    opponentsByTeam.get(teamA.id)?.add(teamB.id);
    opponentsByTeam.get(teamB.id)?.add(teamA.id);
    if (gameWeek > 0) {
      weeksByTeam.get(teamA.id)?.add(gameWeek);
      weeksByTeam.get(teamB.id)?.add(gameWeek);
    }
    if (isConferenceGame(teamA, teamB)) {
      teamA.confGames += 1;
      teamB.confGames += 1;
    } else {
      teamA.nonConfGames += 1;
      teamB.nonConfGames += 1;
    }
    return true;
  };

  for (const game of existingGames) {
    const teamA = byId.get(game.teamAId);
    const teamB = byId.get(game.teamBId);
    if (!teamA || !teamB || !register(teamA, teamB, game.weekPlayed)) return false;
  }
  if (!register(userTeam, opponent, week)) return false;
  for (const required of requiredGames) {
    const teamA = byId.get(required.teamA.id);
    const teamB = byId.get(required.teamB.id);
    if (!teamA || !teamB) return false;
    if (opponentsByTeam.get(teamA.id)?.has(teamB.id)) continue;
    if (!register(teamA, teamB, required.weekPlayed)) return false;
  }

  const conferenceNames = Array.from(new Set(cloned.map(team => team.conference)))
    .filter(name => name !== 'Independent');
  for (const name of conferenceNames) {
    const members = cloned.filter(team => team.conference === name);
    const target = members.reduce(
      (maximum, team) => Math.max(maximum, team.confLimit),
      0,
    );
    members.forEach(team => {
      team.confLimit = target;
      team.nonConfLimit = REGULAR_SEASON_GAMES - target;
    });
    if ((members.length * target) % 2 === 1) {
      const rotation = members
        .slice()
        .sort((left, right) =>
          stableNumber(left.id, year) - stableNumber(right.id, year),
        )
        .find(team => team.confGames <= target - 1);
      if (!rotation) return false;
      rotation.confLimit = target - 1;
      rotation.nonConfLimit = REGULAR_SEASON_GAMES - rotation.confLimit;
    }
  }

  for (const team of cloned) {
    if (team.confGames > team.confLimit || team.nonConfGames > team.nonConfLimit) {
      return false;
    }
    const scheduled = opponentsByTeam.get(team.id) ?? new Set<number>();
    const conferencePotential = cloned.filter(candidate =>
      candidate.id !== team.id &&
      candidate.conference === team.conference &&
      team.conference !== 'Independent' &&
      !scheduled.has(candidate.id),
    ).length;
    const nonConferencePotential = cloned.filter(candidate =>
      candidate.id !== team.id &&
      !scheduled.has(candidate.id) &&
      (candidate.conference !== team.conference || team.conference === 'Independent'),
    ).length;
    if (
      conferencePotential < team.confLimit - team.confGames ||
      nonConferencePotential < team.nonConfLimit - team.nonConfGames
    ) return false;
  }

  for (const name of conferenceNames) {
    const remaining = cloned
      .filter(team => team.conference === name)
      .reduce((total, team) => total + team.confLimit - team.confGames, 0);
    if (remaining % 2 !== 0) return false;
  }

  const nonConferenceDemand = new Map<string, number>();
  cloned.forEach(team => {
    const group = team.conference === 'Independent'
      ? `Independent:${team.id}`
      : team.conference;
    nonConferenceDemand.set(
      group,
      (nonConferenceDemand.get(group) ?? 0) + team.nonConfLimit - team.nonConfGames,
    );
  });
  const totalDemand = Array.from(nonConferenceDemand.values())
    .reduce((total, demand) => total + demand, 0);
  if (totalDemand % 2 !== 0) return false;
  return Array.from(nonConferenceDemand.values())
    .every(demand => demand <= totalDemand - demand);
};
