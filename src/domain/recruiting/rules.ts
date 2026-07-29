import type { RecruitingRuleViolation } from '../../types/recruiting';

export const roundRecruitingValue = (value: number) =>
  Math.round(value * 1000) / 1000;

export class RecruitingRuleViolationError extends Error {
  constructor(readonly violations: RecruitingRuleViolation[]) {
    super(
      `Invalid recruiting action: ${violations
        .map(violation => violation.code)
        .join(', ')}`,
    );
    this.name = 'RecruitingRuleViolationError';
  }
}

export const getRecruitingBudget = (prestige: number) =>
  90 + (Math.min(7, Math.max(1, Math.round(prestige))) - 1) * 5;

export const getMaxProspectAllocation = (pointBudget: number) =>
  Math.floor(pointBudget * 0.25);

export const calculateInterestGain = (points: number, fit: number) =>
  roundRecruitingValue(
    points * (0.75 + Math.min(100, Math.max(0, fit)) / 200),
  );
