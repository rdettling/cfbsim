import type {
  AiPositionNeed,
  AiRecruitingSnapshot,
  RecruitingSimulationState,
} from '../../types/recruiting';
import { ROSTER } from '../rosterConfig';
import { canRosterAcceptCommitment } from './capacity';
import { AI_RECRUITING } from './config';
import type { RecruitingContext } from './context';
import { calculateTeamFit } from './fit';
import { getMaxProspectAllocation, roundRecruitingValue } from './rules';

const positionNeeds = (
  teamId: number,
  commitmentIds: number[],
  state: RecruitingSimulationState,
  context: RecruitingContext,
) => {
  const committedByPosition = new Map<string, number>();
  const prospectsById = new Map(
    state.prospects.map(prospect => [prospect.id, prospect]),
  );
  commitmentIds.forEach(id => {
    const position = prospectsById.get(id)?.position;
    if (position) {
      committedByPosition.set(
        position,
        (committedByPosition.get(position) ?? 0) + 1,
      );
    }
  });
  const roster = context.rostersByTeamId.get(teamId);
  return Object.fromEntries(
    Object.entries(ROSTER).map(([position, config]) => {
      const returning = roster?.positions.get(position)?.count ?? 0;
      const committed = committedByPosition.get(position) ?? 0;
      const projected = returning + committed;
      return [
        position,
        {
          returning,
          committed,
          projected,
          starters: config.starters,
          softTarget: config.total,
          starterShortage: Math.max(0, config.starters - projected),
          softDeficit: Math.max(0, config.total - projected),
        } satisfies AiPositionNeed,
      ];
    }),
  );
};

export type AiRecruitingFitLookup = Map<number, Map<number, number>>;

export const buildAiRecruitingFitLookup = (
  state: RecruitingSimulationState,
  context: RecruitingContext,
): AiRecruitingFitLookup =>
  new Map(
    state.teams.map(teamState => {
      const team = context.teamsById.get(teamState.teamId);
      if (!team) {
        throw new Error(
          `Recruiting context is missing team ${teamState.teamId}.`,
        );
      }
      return [
        teamState.teamId,
        new Map(
          state.prospects.map(prospect => [
            prospect.id,
            calculateTeamFit(prospect, team, context),
          ]),
        ),
      ];
    }),
  );

export const buildAiRecruitingSnapshot = (
  state: RecruitingSimulationState,
  context: RecruitingContext,
  fitLookup: AiRecruitingFitLookup = buildAiRecruitingFitLookup(
    state,
    context,
  ),
): AiRecruitingSnapshot => {
  const sourceProspectsById = new Map(
    state.prospects.map(prospect => [prospect.id, prospect]),
  );
  const boardTeamsByProspect = new Map<number, Set<number>>();
  state.teams.forEach(team => {
    team.board.forEach(prospectId => {
      const teams = boardTeamsByProspect.get(prospectId) ?? new Set<number>();
      teams.add(team.teamId);
      boardTeamsByProspect.set(prospectId, teams);
    });
  });
  const prospects = [...state.prospects]
    .sort((left, right) => left.id - right.id)
    .map(prospect => ({
      id: prospect.id,
      nationalRank: prospect.nationalRank,
      position: prospect.position,
      stars: prospect.stars,
      preferenceWeights: { ...prospect.preferenceWeights },
      committedTeamId: prospect.committedTeamId,
      interest: [...prospect.interest]
        .sort((left, right) => left.teamId - right.teamId)
        .map(entry => ({
          teamId: entry.teamId,
          totalInterest: roundRecruitingValue(
            entry.initial + entry.earned,
          ),
          lifetimePoints: entry.lifetimePoints,
          onBoard:
            boardTeamsByProspect.get(prospect.id)?.has(entry.teamId) ??
            false,
        })),
    }));

  const teams = [...state.teams]
    .sort((left, right) => left.teamId - right.teamId)
    .map(teamState => {
      const team = context.teamsById.get(teamState.teamId);
      const roster = context.rostersByTeamId.get(teamState.teamId);
      if (!team || !roster) {
        throw new Error(
          `Recruiting context is missing team ${teamState.teamId}.`,
        );
      }
      const committedPositions = teamState.commitmentIds
        .map(id => sourceProspectsById.get(id)?.position)
        .filter((position): position is string => Boolean(position));
      const canAcceptByPosition = new Map(
        Object.keys(ROSTER).map(position => [
          position,
          canRosterAcceptCommitment(
            roster,
            teamState.oversignCapacity,
            [...committedPositions, position],
          ),
        ]),
      );
      const remainingBaseSlots = Math.max(
        0,
        teamState.baseSigningCapacity - teamState.commitmentIds.length,
      );
      const remainingMaximumSlots = Math.max(
        0,
        teamState.oversignCapacity - teamState.commitmentIds.length,
      );
      const remainingTargetSlots = Math.min(
        remainingMaximumSlots,
        Math.max(
          0,
          teamState.baseSigningCapacity +
            AI_RECRUITING.targetOversignings -
            teamState.commitmentIds.length,
        ),
      );
      const fits = fitLookup.get(teamState.teamId);
      if (!fits) {
        throw new Error(
          `Recruiting fit lookup is missing team ${teamState.teamId}.`,
        );
      }
      return {
        teamId: teamState.teamId,
        pointBudget: teamState.pointBudget,
        perProspectCap: getMaxProspectAllocation(teamState.pointBudget),
        board: [...teamState.board],
        commitmentIds: [...teamState.commitmentIds],
        remainingBaseSlots,
        remainingTargetSlots,
        remainingMaximumSlots,
        positions: positionNeeds(
          teamState.teamId,
          teamState.commitmentIds,
          state,
          context,
        ),
        prospectFits: prospects.map(prospect => {
          const fit = fits.get(prospect.id);
          if (fit === undefined) {
            throw new Error(
              `Recruiting fit lookup is missing prospect ${prospect.id} for team ${teamState.teamId}.`,
            );
          }
          return {
            prospectId: prospect.id,
            fit,
            canAccept:
              prospect.committedTeamId === null &&
              (canAcceptByPosition.get(prospect.position) ?? false),
          };
        }),
      };
    });

  return {
    year: state.year,
    round: state.round,
    remainingRounds: 7 - state.round,
    seed: state.seed,
    prospects,
    teams,
  };
};
