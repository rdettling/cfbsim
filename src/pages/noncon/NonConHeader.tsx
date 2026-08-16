import { Box, Chip, Stack, Typography } from '@mui/material';
import type { NonConPageData } from '../../types/pages';

type NonConHeaderProps = {
  team: NonConPageData['team'];
  scheduledWeeks: number;
  pendingRivalries: number;
};

export const NonConHeader = ({
  team,
  scheduledWeeks,
  pendingRivalries,
}: NonConHeaderProps) => (
  <Box component="header" sx={{ mb: 1.25 }}>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
      }}
    >
      <Typography component="h1" variant="h6">
        Non-Conference Scheduling
      </Typography>

      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', flexShrink: 0 }}>
        <Chip
          label={`Manual games ${team.nonConfGames}/${team.nonConfLimit}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip label={`${scheduledWeeks} fixed`} variant="outlined" size="small" />
        <Chip label={`${pendingRivalries} pending rivalries`} variant="outlined" size="small" />
      </Stack>
    </Stack>
  </Box>
);
