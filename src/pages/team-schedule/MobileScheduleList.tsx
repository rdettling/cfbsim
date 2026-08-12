import { Box, Paper, Stack, Typography } from '@mui/material';
import {
  ScheduleGameAction,
  ScheduleGameLabel,
  ScheduleOpponent,
} from './ScheduleGameDetails';
import { getScheduleVenueLabel } from './scheduleVenue';
import type { ScheduleViewProps } from './types';

export const MobileScheduleList = ({ games, seasonYear, onOpponentClick }: ScheduleViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={`${seasonYear} season schedule`}
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {games.map((game, index) => (
      <Box
        key={game.rowKey}
        sx={{
          p: 1.5,
          bgcolor: game.kind === 'game' ? 'background.paper' : 'action.hover',
          borderBottom: index === games.length - 1 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
            }}
          >
            Week {game.weekPlayed}
          </Typography>
          {game.kind === 'game' && game.label && <ScheduleGameLabel game={game} />}
        </Stack>

        {game.kind === 'game' ? (
          <>
            <Box sx={{ mt: 1 }}>
              <ScheduleOpponent game={game} onClick={onOpponentClick} />
            </Box>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                mt: 1.25,
              }}
            >
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Box sx={{ maxWidth: 130 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block' }}
                  >
                    Venue
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {getScheduleVenueLabel(game)}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block' }}
                  >
                    Spread
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {game.spread || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block' }}
                  >
                    Moneyline
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {game.moneyline || '—'}
                  </Typography>
                </Box>
              </Stack>
              <ScheduleGameAction game={game} />
            </Stack>
          </>
        ) : (
          <Typography
            sx={{
              color: 'text.secondary',
              mt: 0.5,
            }}
          >
            Bye week
          </Typography>
        )}
      </Box>
    ))}
  </Paper>
);
