import { Box, Chip, Stack, Typography } from '@mui/material';
import type { AwardMode } from './types';

type AwardsHeaderProps = {
  year: number;
  week: number;
  mode: AwardMode;
};

export const AwardsHeader = ({ year, week, mode }: AwardsHeaderProps) => (
  <Stack
    component="header"
    direction="row"
    spacing={2}
    sx={{
      alignItems: 'center',
      justifyContent: 'space-between',
      mb: 1.25,
      flexShrink: 0,
    }}
  >
    <Box>
      <Typography component="h1" variant="h4">
        Individual Awards
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {year} season · Week {week} · {mode === 'final' ? 'Final results' : 'Live award races'}
      </Typography>
    </Box>
    <Chip
      label={mode === 'final' ? 'Final' : 'Live'}
      color={mode === 'final' ? 'success' : 'primary'}
      variant="outlined"
      size="small"
    />
  </Stack>
);
