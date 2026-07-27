import { Box, Paper, Typography } from '@mui/material';
import type { RosterProgressionPageData } from '../../types/pages';

interface ProgressionSummaryProps {
  summary: RosterProgressionPageData['summary'];
}

const formatSigned = (value: number) => (value > 0 ? `+${value}` : String(value));

export const ProgressionSummary = ({ summary }: ProgressionSummaryProps) => {
  const metrics = [
    {
      label: 'Returning',
      value: summary.returningPlayers,
    },
    {
      label: 'Graduating',
      value: summary.departingSeniors,
    },
    {
      label: 'Average Change',
      value: formatSigned(summary.averageRatingChange),
    },
    {
      label: 'Maximum Change',
      value: formatSigned(summary.maximumRatingChange),
    },
  ];

  return (
    <Paper
      component="section"
      aria-label="Projected roster summary"
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
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
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
