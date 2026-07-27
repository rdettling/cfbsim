import { Box, Paper, Typography } from '@mui/material';
import type { RecruitingTeamResult } from '../../types/recruiting';

interface RecruitingUserSummaryProps {
  teamName: string;
  result: RecruitingTeamResult | null;
}

const SummaryItem = ({ label, value }: { label: string; value: string | number }) => (
  <Box sx={{ px: 1.5, py: 1.1, minWidth: 0 }}>
    <Typography
      variant="caption"
      sx={{
        color: 'text.secondary',
        display: 'block',
      }}
    >
      {label}
    </Typography>
    <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
      {value}
    </Typography>
  </Box>
);

export const RecruitingUserSummary = ({ teamName, result }: RecruitingUserSummaryProps) => (
  <Paper
    component="section"
    aria-label={`${teamName} recruiting class summary`}
    variant="outlined"
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: 'repeat(2, minmax(0, 1fr))',
        sm: 'repeat(4, minmax(0, 1fr))',
      },
      mb: 1.25,
      '& > *:not(:last-child)': {
        borderRight: { sm: '1px solid' },
        borderColor: { sm: 'divider' },
      },
      '& > *:nth-of-type(-n+2)': {
        borderBottom: { xs: '1px solid', sm: 0 },
        borderColor: { xs: 'divider' },
      },
    }}
  >
    <SummaryItem label={`${teamName} class rank`} value={result ? `#${result.rank}` : '—'} />
    <SummaryItem label="Recruits" value={result?.totalRecruits ?? 0} />
    <SummaryItem label="Average rating" value={result?.averageRating ?? '—'} />
    <SummaryItem label="Five-star recruits" value={result?.starCounts.five ?? 0} />
  </Paper>
);
