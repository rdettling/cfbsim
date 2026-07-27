import { Box, Paper, Stack, Typography } from '@mui/material';
import {
  ScheduleGameAction,
  ScheduleGameLabel,
  ScheduleOpponent,
  ScheduleSiteBadge,
} from './ScheduleGameDetails';
import type { ScheduleViewProps } from './types';

export const MobileScheduleList = ({
  games,
  seasonYear,
  onOpponentClick,
}: ScheduleViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={`${seasonYear} season schedule`}
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {games.map((game, index) => (
      <Box
        key={game.weekPlayed}
        sx={{
          p: 1.5,
          bgcolor: game.opponent ? 'background.paper' : 'action.hover',
          borderBottom: index === games.length - 1 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="overline" color="text.secondary">
            Week {game.weekPlayed}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            {game.opponent && <ScheduleSiteBadge game={game} />}
            {game.label && <ScheduleGameLabel game={game} />}
          </Stack>
        </Stack>

        {game.opponent ? (
          <>
            <Box sx={{ mt: 1 }}>
              <ScheduleOpponent game={game} onClick={onOpponentClick} />
            </Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-end"
              spacing={1.5}
              sx={{ mt: 1.25 }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Spread
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {game.spread || '—'}
                </Typography>
              </Box>
              <ScheduleGameAction game={game} />
            </Stack>
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Bye week
          </Typography>
        )}
      </Box>
    ))}
  </Paper>
);
