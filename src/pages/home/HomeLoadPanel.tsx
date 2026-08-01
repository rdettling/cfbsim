import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getStageDefinition, getStageRoute } from '../../constants/stages';
import type { Info } from '../../types/domain';
import { TeamLogo } from '../../components/team/TeamLogo';

type HomeLoadPanelProps = {
  info: Info | null;
  onStartNew: () => void;
};

export const HomeLoadPanel = ({ info, onStartNew }: HomeLoadPanelProps) => {
  if (!info) {
    return (
      <Paper variant="outlined" sx={{ maxWidth: 640, mx: 'auto', p: 4, textAlign: 'center' }}>
        <Typography variant="h5">No saved league</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.75,
          }}
        >
          Create a league to begin a college football dynasty.
        </Typography>
        <Button variant="contained" onClick={onStartNew} sx={{ mt: 2.5 }}>
          Start a new league
        </Button>
      </Paper>
    );
  }

  const stage = getStageDefinition(info.stage);
  const stageLabel =
    info.stage === 'season' ? `${stage.label} · Week ${info.currentWeek}` : stage.label;

  return (
    <Paper variant="outlined" sx={{ maxWidth: 680, mx: 'auto', p: { xs: 2.5, sm: 4 } }}>
      <Typography
        variant="overline"
        sx={{
          color: 'text.secondary',
        }}
      >
        Current save
      </Typography>
      <Typography variant="h4">Continue your league</Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          my: 3,
        }}
      >
        <TeamLogo name={info.team} size={64} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">{info.team}</Typography>
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            {info.currentYear} Season
          </Typography>
        </Box>
        <Chip label={stageLabel} color="primary" variant="outlined" />
      </Stack>
      <Button
        component={RouterLink}
        to={getStageRoute(info.stage)}
        variant="contained"
        size="large"
        fullWidth
      >
        Continue game
      </Button>
    </Paper>
  );
};
