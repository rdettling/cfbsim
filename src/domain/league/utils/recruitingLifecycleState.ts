import { assertCurrentRecruitingState } from '../../../db/recruitingRepo';
import {
  RecruitingConflictError,
  type RecruitingState,
} from '../../../types/recruiting';

export const requireRecruitingState = (
  state: unknown,
): RecruitingState => {
  if (!state) {
    throw new RecruitingConflictError('STATE_MISSING', 'current', null);
  }
  assertCurrentRecruitingState(state);
  return state;
};

export const requireFinalizedRecruitingState = (
  state: unknown,
  year: number,
) => {
  const required = requireRecruitingState(state);
  if (required.year !== year) {
    throw new RecruitingConflictError('YEAR_MISMATCH', year, required.year);
  }
  if (required.status !== 'finalized') {
    throw new RecruitingConflictError(
      'STATUS_MISMATCH',
      'finalized',
      required.status,
    );
  }
  return required;
};
