import { Box, Paper, Typography } from '@mui/material';
import type { RecruitingPageData } from '../../types/pages';

interface RecruitingSummaryStripProps {
  data: RecruitingPageData;
  draftPoints: number;
}

export const RecruitingSummaryStrip = ({
  data,
  draftPoints,
}: RecruitingSummaryStripProps) => {
  const recruiting = data.userRecruiting;
  const cursor = data.cursor;
  if (!recruiting || !cursor) return null;

  const metrics = [
    { label: 'Round', value: `${cursor.round} of 6` },
    {
      label: 'Your Points',
      value: `${draftPoints} assigned`,
    },
    {
      label: 'AI Available',
      value: `${Math.max(0, recruiting.pointBudget - draftPoints)} points`,
    },
    {
      label: 'Board',
      value: `${recruiting.boardIds.length} / ${recruiting.boardLimit}`,
    },
    {
      label: 'Commitments',
      value: `${recruiting.commitmentIds.length} / ${recruiting.maximumSigningCapacity}`,
    },
    {
      label: 'Base Slots Left',
      value: recruiting.remainingBaseSlots,
    },
    {
      label: 'Max Slots Left',
      value: recruiting.remainingMaximumSlots,
    },
  ];

  return (
    <Paper
      component="section"
      aria-label="Recruiting round summary"
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
          lg: `repeat(${metrics.length}, minmax(0, 1fr))`,
        },
        mb: 1.25,
        overflow: 'hidden',
      }}
    >
      {metrics.map((metric, index) => (
        <Box
          key={metric.label}
          sx={{
            px: 1.5,
            py: 0.9,
            borderRight: {
              xs: index % 2 === 0 ? '1px solid' : 0,
              md: index % 3 !== 2 ? '1px solid' : 0,
              lg: index < metrics.length - 1 ? '1px solid' : 0,
            },
            borderBottom: {
              xs: index < metrics.length - (metrics.length % 2 || 2)
                ? '1px solid'
                : 0,
              md: index < metrics.length - (metrics.length % 3 || 3)
                ? '1px solid'
                : 0,
              lg: 0,
            },
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {metric.label}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {metric.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};
