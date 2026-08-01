import { Box, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import type { AwardsPageData } from '../../types/pages';

export const AwardsHistory = ({
  history,
  onTeamClick,
}: {
  history: AwardsPageData['history'];
  onTeamClick: (teamName: string) => void;
}) => {
  if (!history.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">No dynasty award history yet</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Final award winners will be archived after the first completed season.
        </Typography>
      </Paper>
    );
  }
  return (
    <Stack spacing={1.25} sx={{ overflowY: { lg: 'auto' } }}>
      {history.map(season => (
        <Paper key={season.year} variant="outlined" sx={{ p: 1.5 }}>
          <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
            {season.year}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {season.winners.map(winner => (
              <Paper key={winner.categorySlug} variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  {winner.categoryName}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {winner.first} {winner.last}
                </Typography>
                <Typography variant="body2">
                  <TeamLink name={winner.teamName} onTeamClick={onTeamClick} /> ·{' '}
                  {winner.position.toUpperCase()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {winner.statLine}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Paper>
      ))}
    </Stack>
  );
};
