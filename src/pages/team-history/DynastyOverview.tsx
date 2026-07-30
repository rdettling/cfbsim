import { Box, Paper, Stack, Typography } from '@mui/material';
import type { TeamHistoryPageData } from '../../types/pages';

type Props = {
  overview: TeamHistoryPageData['dynastyOverview'];
};

export const DynastyOverview = ({ overview }: Props) => {
  const stats = [
    { label: 'Dynasty Record', value: `${overview.wins}-${overview.losses}` },
    {
      label: 'Best Final Rank',
      value: overview.bestFinalRank ? `#${overview.bestFinalRank}` : 'Unranked',
    },
    { label: 'Conference Titles', value: overview.conferenceTitles },
    { label: 'Playoff Appearances', value: overview.playoffAppearances },
    { label: 'Bowl Wins', value: overview.bowlWins },
    { label: 'National Titles', value: overview.nationalTitles },
    { label: 'Award Winners', value: overview.awardWinners },
  ];
  return (
    <Paper component="section" variant="outlined" sx={{ mb: 1.5, p: 1.5 }}>
      <Stack
        direction="row"
        useFlexGap
        sx={{ flexWrap: 'wrap', gap: { xs: 1.5, md: 3 } }}
      >
        {stats.map(stat => (
          <Box key={stat.label} sx={{ minWidth: 105 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {stat.label}
            </Typography>
            <Typography variant="h6">{stat.value}</Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};
