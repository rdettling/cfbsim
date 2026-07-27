import { Box, Paper, Typography } from '@mui/material';
import type { RosterCutsSummary } from '../../types/roster';

interface RosterCutsSummaryStripProps {
  summary: RosterCutsSummary;
}

export const RosterCutsSummaryStrip = ({
  summary,
}: RosterCutsSummaryStripProps) => {
  const metrics = [
    { label: 'Active Roster', value: summary.activePlayers },
    { label: 'Projected Cuts', value: summary.projectedCuts },
    {
      label: 'Projected Roster',
      value: summary.projectedRosterSize,
    },
    {
      label: 'Positions Over Limit',
      value: summary.positionsOverLimit,
    },
  ];

  return (
    <Paper
      component="section"
      aria-label="Roster cuts summary"
      variant="outlined"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
        mb: 1.25,
        overflow: 'hidden',
      }}
    >
      {metrics.map((metric, index) => (
        <Box
          key={metric.label}
          sx={{
            px: { xs: 1.5, md: 2 },
            py: 1.1,
            borderRight: {
              xs: index % 2 === 0 ? '1px solid' : 0,
              md: index < metrics.length - 1 ? '1px solid' : 0,
            },
            borderBottom: {
              xs: index < 2 ? '1px solid' : 0,
              md: 0,
            },
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {metric.label}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {metric.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};
