import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
import type {
  RosterCutPlayerPreview,
  RosterCutsPreview,
} from '../types/roster';
import { POSITION_ORDER, ROSTER } from './rosterConfig';

const CLASS_SENIORITY: Record<PlayerRecord['year'], number> = {
  fr: 1,
  so: 2,
  jr: 3,
  sr: 4,
};

const compareRetentionPriority = (
  left: PlayerRecord,
  right: PlayerRecord,
) =>
  right.rating_sr - left.rating_sr ||
  right.rating - left.rating ||
  CLASS_SENIORITY[right.year] - CLASS_SENIORITY[left.year] ||
  left.id - right.id;

export const selectTeamRosterCuts = (
  players: PlayerRecord[],
  teamId: number,
): PlayerRecord[] => {
  const activePlayers = players.filter(
    player => player.active && player.teamId === teamId,
  );

  return POSITION_ORDER.flatMap(position => {
    const positionPlayers = activePlayers
      .filter(player => player.pos === position)
      .sort(compareRetentionPriority);
    return positionPlayers.slice(ROSTER[position].total);
  });
};

const toPlayerPreview = (
  player: PlayerRecord,
): RosterCutPlayerPreview => ({
  id: player.id,
  first: player.first,
  last: player.last,
  position: player.pos,
  currentClass: player.year,
  currentRating: player.rating,
  seniorRating: player.rating_sr,
});

export const buildRosterCutsPreview = (
  players: PlayerRecord[],
  teamId: number,
): RosterCutsPreview => {
  const activePlayers = players.filter(
    player => player.active && player.teamId === teamId,
  );
  const cutPlayers = selectTeamRosterCuts(players, teamId);
  const cutIds = new Set(cutPlayers.map(player => player.id));
  const positions = POSITION_ORDER.map(position => {
    const positionPlayers = activePlayers.filter(
      player => player.pos === position,
    );
    const projectedCuts = positionPlayers.filter(player =>
      cutIds.has(player.id),
    ).length;

    return {
      position,
      activePlayers: positionPlayers.length,
      rosterLimit: ROSTER[position].total,
      projectedCuts,
      projectedPlayers: positionPlayers.length - projectedCuts,
    };
  });

  return {
    cuts: cutPlayers.map(toPlayerPreview),
    positions,
    summary: {
      activePlayers: activePlayers.length,
      projectedCuts: cutPlayers.length,
      projectedRosterSize: activePlayers.length - cutPlayers.length,
      positionsOverLimit: positions.filter(
        position => position.projectedCuts > 0,
      ).length,
    },
  };
};

export const applyRosterCuts = (
  teams: Team[],
  players: PlayerRecord[],
) => {
  const cutIds = new Set(
    teams.flatMap(team =>
      selectTeamRosterCuts(players, team.id).map(player => player.id),
    ),
  );

  players.forEach(player => {
    if (!cutIds.has(player.id)) return;
    player.active = false;
    player.starter = false;
  });
};
