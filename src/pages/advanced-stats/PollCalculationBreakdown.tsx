import { Box, Chip, Stack, Typography } from '@mui/material';
import {
  EVIDENCE_PERFORMANCE_WEIGHT,
  EVIDENCE_RESUME_WEIGHT,
} from '../../domain/sim/rankingScores';
import type { AdvancedTeamStatsRow } from '../../types/stats';

const score = (value: number) => value.toFixed(1);
const percent = (value: number) => `${(value * 100).toFixed(0)}%`;

export const PollCalculationBreakdown = ({
  row,
}: {
  row: AdvancedTeamStatsRow;
}) => {
  const projectionLabel = row.pollScoreMatchesProjection
    ? 'Published poll calculation'
    : 'Current poll projection';
  return (
    <Box sx={{ px: 1.5, py: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        sx={{ alignItems: { sm: 'center' }, mb: 0.75 }}
      >
        <Typography variant="subtitle2">{projectionLabel}</Typography>
        {row.pollRankOverrideReason && (
          <Chip
            label={row.pollRankOverrideReason === 'playoff_selection'
              ? 'Playoff selection rank override'
              : 'Championship placement rank override'}
            size="small"
            variant="outlined"
          />
        )}
      </Stack>

      {!row.pollScoreMatchesProjection && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
          The published Poll Score remains {score(row.pollScore)} until rankings
          publish again. Current completed-game inputs project {score(row.projectedPollScore)}.
        </Typography>
      )}

      <Stack spacing={0.35}>
        <Typography variant="body2">
          Team Rating {score(row.teamRating)} maps to Team Score {score(row.teamScore)}.
        </Typography>
        {row.games === 0 ? (
          <Typography variant="body2">
            {row.pollScoreMatchesProjection ? 'Poll Score' : 'Projected Poll Score'}{' '}
            {score(row.projectedPollScore)} = 100% × Team Score {score(row.teamScore)}.
          </Typography>
        ) : (
          <>
            <Typography variant="body2">
              Evidence Score {score(row.evidenceScore)} ={' '}
              {(EVIDENCE_RESUME_WEIGHT * 100).toFixed(1)}% × Résumé Score{' '}
              {score(row.resumeScore)} +{' '}
              {(EVIDENCE_PERFORMANCE_WEIGHT * 100).toFixed(1)}% × Performance Index{' '}
              {score(row.performanceIndex)}.
            </Typography>
            <Typography variant="body2">
              {row.pollScoreMatchesProjection ? 'Poll Score' : 'Projected Poll Score'}{' '}
              {score(row.projectedPollScore)} = {percent(row.teamRatingPriorWeight)} × Team
              Score {score(row.teamScore)} + {percent(1 - row.teamRatingPriorWeight)} ×
              Evidence Score {score(row.evidenceScore)} ={' '}
              {score(row.teamScoreContribution)} + {score(row.evidenceScoreContribution)}.
            </Typography>
          </>
        )}
      </Stack>

      {row.pollRankOverrideReason && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
          Official rank No. {row.pollRank} differs from Poll Score order because
          {row.pollRankOverrideReason === 'playoff_selection'
            ? ' playoff selection controls postseason rank.'
            : ' championship placement controls the final rank.'}
        </Typography>
      )}
    </Box>
  );
};
