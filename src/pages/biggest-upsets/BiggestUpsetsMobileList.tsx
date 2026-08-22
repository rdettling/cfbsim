import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import type { BiggestUpsetGame } from '../../domain/league/loaders/biggestUpsets';
import {
  formatOvertime,
  formatUpsetProbability,
  formatUpsetScore,
} from './presentation';
import { UpsetTeamIdentity } from './UpsetTeamIdentity';

export const BiggestUpsetsMobileList = ({
  upsets,
  onTeamClick,
}: {
  upsets: BiggestUpsetGame[];
  onTeamClick: (name: string) => void;
}) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label="Biggest upsets"
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {upsets.map((upset, index) => {
      const overtime = formatOvertime(upset.overtime);
      return (
        <Box
          component="article"
          key={upset.gameId}
          sx={{
            p: 1.5,
            borderBottom: index === upsets.length - 1 ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Week {upset.week} · {upset.label}
            </Typography>
            <Chip
              label={`${formatUpsetProbability(upset.winnerWinProbability)} chance`}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Stack>

          <Stack spacing={0.875} sx={{ mt: 1.25 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <UpsetTeamIdentity team={upset.winner} onTeamClick={onTeamClick} />
              </Box>
              <Typography sx={{ fontWeight: 700 }}>{upset.winner.score}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <UpsetTeamIdentity team={upset.loser} onTeamClick={onTeamClick} />
              </Box>
              <Typography sx={{ fontWeight: 600 }}>{upset.loser.score}</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Final {formatUpsetScore(upset)}{overtime ? ` · ${overtime}` : ''}
            </Typography>
            <Button component={RouterLink} to={`/game/${upset.gameId}`} size="small">
              Summary
            </Button>
          </Stack>
        </Box>
      );
    })}
  </Paper>
);
