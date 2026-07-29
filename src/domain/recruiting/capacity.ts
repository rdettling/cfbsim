import type { RecruitingContext, TeamRosterContext } from './context';
import { ROSTER } from '../rosterConfig';
import { RECRUITING } from './config';
import { RecruitingRuleViolationError } from './rules';

export const calculateSigningCapacity = (
  context: RecruitingContext,
  teamId: number,
) => {
  const roster = context.rostersByTeamId.get(teamId);
  if (!context.teamsById.has(teamId) || !roster) {
    throw new RecruitingRuleViolationError([{ code: 'UNKNOWN_TEAM', teamId }]);
  }
  const returning = roster.activeCount;
  const base = Math.max(0, RECRUITING.rosterSize - returning);
  const rosterRoom = Math.max(0, RECRUITING.maxRosterSize - returning);
  return {
    returning,
    base,
    maximum: Math.min(base + RECRUITING.oversignAllowance, rosterRoom),
  };
};

const countPositions = (positions: string[]) =>
  positions.reduce<Record<string, number>>((counts, position) => {
    counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {});

export const canRosterAcceptCommitment = (
  roster: TeamRosterContext | undefined,
  maximumCommitments: number,
  incomingPositions: string[],
) => {
  const returning = roster?.activeCount ?? 0;
  if (incomingPositions.length > maximumCommitments) return false;
  if (returning + incomingPositions.length > RECRUITING.maxRosterSize) {
    return false;
  }

  const cutsRequired = Math.max(
    0,
    returning + incomingPositions.length - RECRUITING.rosterSize,
  );
  const incomingCounts = countPositions(incomingPositions);
  const starterShortages = Object.entries(ROSTER).reduce(
    (total, [position, config]) =>
      total +
      Math.max(
        0,
        config.starters -
          (roster?.positions.get(position)?.count ?? 0) -
          (incomingCounts[position] ?? 0),
      ),
    0,
  );
  const remainingBaseSlots = Math.max(
    0,
    RECRUITING.rosterSize - returning - incomingPositions.length,
  );
  if (starterShortages > remainingBaseSlots) return false;
  const configuredCuttable = Object.entries(ROSTER).reduce(
    (total, [position, config]) => {
      const requiredReturning = Math.max(
        0,
        config.starters - (incomingCounts[position] ?? 0),
      );
      const returningAtPosition =
        roster?.positions.get(position)?.count ?? 0;
      return total + Math.max(0, returningAtPosition - requiredReturning);
    },
    0,
  );
  const configuredReturning = Object.keys(ROSTER).reduce(
    (total, position) =>
      total + (roster?.positions.get(position)?.count ?? 0),
    0,
  );
  return configuredCuttable + (returning - configuredReturning) >= cutsRequired;
};

export const canAcceptCommitment = (
  context: RecruitingContext,
  teamId: number,
  incomingPositions: string[],
) => {
  const capacity = calculateSigningCapacity(context, teamId);
  return canRosterAcceptCommitment(
    context.rostersByTeamId.get(teamId)!,
    capacity.maximum,
    incomingPositions,
  );
};
