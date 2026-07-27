import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import type { NonConPageData } from '../../types/pages';
import type { TeamSelectionHandler } from './types';

type NonConHeaderProps = {
  team: NonConPageData['team'];
  year: number;
  scheduledWeeks: number;
  openWeeks: number;
  remainingManualGames: number;
  onTeamClick: TeamSelectionHandler;
};

export const NonConHeader = ({
  team,
  year,
  scheduledWeeks,
  openWeeks,
  remainingManualGames,
  onTeamClick,
}: NonConHeaderProps) => (
  <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 1.25 }}>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={1.5}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <TeamLogo name={team.name} size={44} />
        <Box>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 800 }}>
            Preseason Scheduling
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {year} · <TeamLink name={team.name} onTeamClick={onTeamClick} />
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <Chip
          label={`Non-Conference ${team.nonConfGames}/${team.nonConfLimit}`}
          variant="outlined"
          size="small"
        />
        <Chip label={`${scheduledWeeks} Scheduled`} variant="outlined" size="small" />
        <Chip label={`${openWeeks} Open`} variant="outlined" size="small" />
        <Chip
          label={`${remainingManualGames} Manual ${
            remainingManualGames === 1 ? 'Slot' : 'Slots'
          }`}
          variant="outlined"
          size="small"
        />
      </Stack>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      Choose optional non-conference games now. Remaining schedule slots will be
      filled automatically when you advance to the season.
    </Typography>
  </Paper>
);
