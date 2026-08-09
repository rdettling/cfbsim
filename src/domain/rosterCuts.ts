import type { PlayerRecord } from '../types/db';
import type { Team } from '../types/domain';
import {
  type RosterCutPlayerPreview,
  type RosterCutsPreview,
  RosterFinalizationRuleError,
} from '../types/roster';
import { createSeededRandom } from './utils/random';
import {
  FINAL_ROSTER_SIZE,
  MAX_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from './rosterConfig';

const CLASS_SENIORITY: Record<PlayerRecord['year'], number> = {
  fr: 1,
  so: 2,
  jr: 3,
  sr: 4,
};

const EXPECTED_REMAINING_RATING_GROWTH: Record<
  PlayerRecord['year'],
  number
> = {
  fr: 10,
  so: 5,
  jr: 2,
  sr: 0,
};

export type RosterCutCandidate = Pick<
  PlayerRecord,
  'id' | 'teamId' | 'year' | 'pos' | 'rating' | 'rating_sr'
>;

const activeTeamPlayers = <TPlayer extends RosterCutCandidate>(
  players: TPlayer[],
  teamId: number,
) =>
  players.filter(player => player.teamId === teamId);

const assertKnownPositions = (
  players: RosterCutCandidate[],
  teamId: number,
) => {
  const invalid = players.find(player => !(player.pos in ROSTER));
  if (invalid) {
    throw new RosterFinalizationRuleError(
      'INVALID_POSITION',
      `Active player ${invalid.id} has unsupported position ${invalid.pos}.`,
      invalid.id,
      teamId,
    );
  }
};

const countsAfterCuts = (
  active: RosterCutCandidate[],
  selectedIds: ReadonlySet<number>,
) =>
  Object.fromEntries(
    POSITION_ORDER.map(position => [
      position,
      active.filter(
        player => player.pos === position && !selectedIds.has(player.id),
      ).length,
    ]),
  ) as Record<string, number>;

export const requiredRosterCuts = (
  players: RosterCutCandidate[],
  teamId: number,
) => Math.max(0, activeTeamPlayers(players, teamId).length - FINAL_ROSTER_SIZE);

export const validateRosterCutSelection = (
  players: RosterCutCandidate[],
  teamId: number,
  selectedCutIds: number[],
  requireComplete = false,
) => {
  const active = activeTeamPlayers(players, teamId);
  assertKnownPositions(active, teamId);
  if (
    active.length < FINAL_ROSTER_SIZE ||
    active.length > MAX_ROSTER_SIZE
  ) {
    throw new RosterFinalizationRuleError(
      'INVALID_ROSTER_SIZE',
      `Team ${teamId} has ${active.length} active players during roster cuts.`,
      undefined,
      teamId,
    );
  }
  const unique = new Set(selectedCutIds);
  if (unique.size !== selectedCutIds.length) {
    throw new RosterFinalizationRuleError(
      'DUPLICATE_CUT',
      `Team ${teamId} has a duplicate cut selection.`,
      undefined,
      teamId,
    );
  }
  const required = active.length - FINAL_ROSTER_SIZE;
  if (selectedCutIds.length > required) {
    throw new RosterFinalizationRuleError(
      'CUT_COUNT_EXCEEDED',
      `Team ${teamId} requires only ${required} cuts.`,
      undefined,
      teamId,
    );
  }
  if (requireComplete && selectedCutIds.length !== required) {
    throw new RosterFinalizationRuleError(
      'CUT_COUNT_INCOMPLETE',
      `Team ${teamId} requires ${required} cuts and has ${selectedCutIds.length}.`,
      undefined,
      teamId,
    );
  }

  const byId = new Map(players.map(player => [player.id, player]));
  for (const id of selectedCutIds) {
    const player = byId.get(id);
    if (!player) {
      throw new RosterFinalizationRuleError(
        'UNKNOWN_PLAYER',
        `Player ${id} does not exist.`,
        id,
        teamId,
      );
    }
    if (player.teamId !== teamId) {
      throw new RosterFinalizationRuleError(
        'WRONG_TEAM',
        `Player ${id} is not on team ${teamId}.`,
        id,
        teamId,
      );
    }
    if (player.year === 'fr') {
      throw new RosterFinalizationRuleError(
        'FRESHMAN_PROTECTED',
        `Freshman ${id} is protected from roster cuts.`,
        id,
        teamId,
      );
    }
  }

  const counts = countsAfterCuts(active, unique);
  const shortage = POSITION_ORDER.find(
    position => counts[position] < ROSTER[position].starters,
  );
  if (shortage) {
    throw new RosterFinalizationRuleError(
      'STARTER_MINIMUM',
      `Team ${teamId} would fall below the ${shortage} starter minimum.`,
      undefined,
      teamId,
    );
  }
  return { requiredCuts: required, counts };
};

export interface RecommendRosterCutsInput<
  TPlayer extends RosterCutCandidate = RosterCutCandidate,
> {
  players: TPlayer[];
  teamId: number;
  year: number;
  seed: number;
  selectedCutIds: number[];
}

const estimateSeniorValue = (player: RosterCutCandidate) =>
  Math.min(
    99,
    player.rating + EXPECTED_REMAINING_RATING_GROWTH[player.year],
  );

export const recommendRosterCuts = <
  TPlayer extends RosterCutCandidate,
>({
  players,
  teamId,
  year,
  seed,
  selectedCutIds,
}: RecommendRosterCutsInput<TPlayer>): TPlayer[] => {
  const active = activeTeamPlayers(players, teamId);
  const { requiredCuts } = validateRosterCutSelection(
    players,
    teamId,
    selectedCutIds,
  );
  const selected = new Set(selectedCutIds);
  const recommendations: TPlayer[] = [];

  while (selected.size < requiredCuts) {
    const counts = countsAfterCuts(active, selected);
    const legal = active.filter(
      player =>
        !selected.has(player.id) &&
        player.year !== 'fr' &&
        counts[player.pos] - 1 >= ROSTER[player.pos].starters,
    );
    if (!legal.length) {
      throw new RosterFinalizationRuleError(
        'NO_LEGAL_CUT',
        `Team ${teamId} cannot reach ${FINAL_ROSTER_SIZE} without cutting a protected freshman or violating a starter minimum.`,
        undefined,
        teamId,
      );
    }
    const largestSurplus = Math.max(
      0,
      ...legal.map(player =>
        Math.max(0, counts[player.pos] - ROSTER[player.pos].total),
      ),
    );
    const pool = largestSurplus
      ? legal.filter(
          player =>
            counts[player.pos] - ROSTER[player.pos].total === largestSurplus,
        )
      : legal;
    const tie = createSeededRandom(seed).fork(
      `roster-cut:${year}:${teamId}:${selected.size}`,
    );
    const choice = [...pool].sort(
      (left, right) =>
        estimateSeniorValue(left) - estimateSeniorValue(right) ||
        left.rating - right.rating ||
        CLASS_SENIORITY[right.year] - CLASS_SENIORITY[left.year] ||
        tie.fork(left.id).next() - tie.fork(right.id).next() ||
        left.id - right.id,
    )[0];
    selected.add(choice.id);
    recommendations.push(choice);
  }
  return recommendations;
};

const toPlayerPreview = (
  player: RosterCutCandidate & Pick<PlayerRecord, 'first' | 'last'>,
  selected: boolean,
  recommended: boolean,
  canSelect: boolean,
  blockedReason: RosterCutPlayerPreview['blockedReason'],
): RosterCutPlayerPreview => ({
  id: player.id,
  first: player.first,
  last: player.last,
  position: player.pos,
  currentClass: player.year,
  currentRating: player.rating,
  selected,
  recommended,
  protected: player.year === 'fr',
  canSelect,
  blockedReason,
});

export interface BuildRosterCutsPreviewInput {
  players: PlayerRecord[];
  teamId: number;
  year: number;
  seed: number;
  selectedCutIds: number[];
}

export const buildRosterCutsPreview = ({
  players,
  teamId,
  year,
  seed,
  selectedCutIds,
}: BuildRosterCutsPreviewInput): RosterCutsPreview => {
  const active = activeTeamPlayers(players, teamId);
  const { requiredCuts, counts } = validateRosterCutSelection(
    players,
    teamId,
    selectedCutIds,
  );
  const recommendations = recommendRosterCuts({
    players,
    teamId,
    year,
    seed,
    selectedCutIds,
  });
  const selected = new Set(selectedCutIds);
  const recommended = new Set(recommendations.map(player => player.id));
  const positionOrder = new Map(
    POSITION_ORDER.map((position, index) => [position, index]),
  );
  const rosterPlayers = [...active].sort(
    (left, right) =>
      (positionOrder.get(left.pos) ?? POSITION_ORDER.length) -
        (positionOrder.get(right.pos) ?? POSITION_ORDER.length) ||
      right.rating - left.rating ||
      left.id - right.id,
  );
  const positions = POSITION_ORDER.map(position => {
    const positionPlayers = active.filter(player => player.pos === position);
    const selectedCuts = positionPlayers.filter(player =>
      selected.has(player.id),
    ).length;
    const projectedCuts = positionPlayers.filter(
      player => selected.has(player.id) || recommended.has(player.id),
    ).length;
    return {
      position,
      activePlayers: positionPlayers.length,
      rosterLimit: ROSTER[position].total,
      starterMinimum: ROSTER[position].starters,
      selectedCuts,
      projectedCuts,
      projectedPlayers: positionPlayers.length - projectedCuts,
    };
  });

  return {
    players: rosterPlayers.map(player => {
      const isSelected = selected.has(player.id);
      if (isSelected) {
        return toPlayerPreview(
          player,
          true,
          false,
          false,
          null,
        );
      }
      if (player.year === 'fr') {
        return toPlayerPreview(
          player,
          false,
          false,
          false,
          'FRESHMAN_PROTECTED',
        );
      }
      if (selected.size >= requiredCuts) {
        return toPlayerPreview(
          player,
          false,
          false,
          false,
          'CUTS_COMPLETE',
        );
      }
      try {
        validateRosterCutSelection(players, teamId, [
          ...selectedCutIds,
          player.id,
        ]);
        return toPlayerPreview(
          player,
          false,
          recommended.has(player.id),
          true,
          null,
        );
      } catch (error) {
        if (
          error instanceof RosterFinalizationRuleError &&
          error.code === 'STARTER_MINIMUM'
        ) {
          return toPlayerPreview(
            player,
            false,
            false,
            false,
            'STARTER_MINIMUM',
          );
        }
        throw error;
      }
    }),
    selectedCutIds: [...selectedCutIds],
    recommendedCutIds: recommendations.map(player => player.id),
    positions,
    summary: {
      activePlayers: active.length,
      requiredCuts,
      selectedCuts: selectedCutIds.length,
      remainingCuts: requiredCuts - selectedCutIds.length,
      projectedCuts: requiredCuts,
      projectedRosterSize: active.length - requiredCuts,
      positionsOverLimit: POSITION_ORDER.filter(
        position => counts[position] > ROSTER[position].total,
      ).length,
    },
  };
};

export const applyRosterCutIds = (
  players: PlayerRecord[],
  cutIds: Iterable<number>,
) => {
  const selected = new Set(cutIds);
  for (let index = players.length - 1; index >= 0; index -= 1) {
    if (selected.has(players[index].id)) players.splice(index, 1);
  }
};

export const assertFinalRosters = (
  teams: Team[],
  players: PlayerRecord[],
) => {
  for (const team of teams) {
    const active = activeTeamPlayers(players, team.id);
    assertKnownPositions(active, team.id);
    if (active.length !== FINAL_ROSTER_SIZE) {
      throw new RosterFinalizationRuleError(
        'INVALID_ROSTER_SIZE',
        `Team ${team.id} has ${active.length} active players after finalization.`,
        undefined,
        team.id,
      );
    }
    const counts = countsAfterCuts(active, new Set());
    const shortage = POSITION_ORDER.find(
      position => counts[position] < ROSTER[position].starters,
    );
    if (shortage) {
      throw new RosterFinalizationRuleError(
        'STARTER_MINIMUM',
        `Team ${team.id} lacks the ${shortage} starter minimum.`,
        undefined,
        team.id,
      );
    }
  }
};
