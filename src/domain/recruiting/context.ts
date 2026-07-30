import type { PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';

export interface PositionDepth {
  count: number;
  ratings: number[];
}

export interface TeamRosterContext {
  activeCount: number;
  positions: Map<string, PositionDepth>;
}

export interface RecruitingContext {
  teamCount: number;
  teamsById: Map<number, Team>;
  rostersByTeamId: Map<number, TeamRosterContext>;
}

export const buildRecruitingContext = (
  teams: Team[],
  players: PlayerRecord[],
): RecruitingContext => {
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const rostersByTeamId = new Map<number, TeamRosterContext>(
    teams.map(team => [
      team.id,
      { activeCount: 0, positions: new Map<string, PositionDepth>() },
    ]),
  );

  players.forEach(player => {
    const roster = rostersByTeamId.get(player.teamId);
    if (!roster) return;
    roster.activeCount += 1;
    const depth = roster.positions.get(player.pos) ?? {
      count: 0,
      ratings: [],
    };
    depth.count += 1;
    depth.ratings.push(player.rating);
    roster.positions.set(player.pos, depth);
  });
  rostersByTeamId.forEach(roster => {
    roster.positions.forEach(depth => {
      depth.ratings.sort((left, right) => right - left);
    });
  });

  return { teamCount: teams.length, teamsById, rostersByTeamId };
};
