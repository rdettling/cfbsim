import type { ConferenceTiebreaker } from '../../types/domain';

export const TIEBREAK_LABELS: Record<ConferenceTiebreaker, { short: string; full: string }> = {
  head_to_head: { short: 'H2H', full: 'Head-to-head' },
  common_opponents: { short: 'Common', full: 'Common opponents' },
  overall_record: { short: 'Overall', full: 'Overall regular-season record' },
  poll_rank: { short: 'Poll', full: 'Post–regular-season poll' },
};
