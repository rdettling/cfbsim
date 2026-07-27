import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import { PLAYER_YEAR_LABELS } from './config';
import type { RosterViewProps } from './types';

export const RosterMobileList = ({ groups }: RosterViewProps) => (
  <Stack
    component="section"
    aria-label="Team roster"
    spacing={1.25}
    sx={{ display: { xs: 'flex', md: 'none' } }}
  >
    {groups.map(group => (
      <Paper key={group.position} variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.5, py: 0.875, bgcolor: 'action.hover' }}
        >
          <Typography sx={{ fontWeight: 600 }}>{group.position.toUpperCase()}</Typography>
          <Typography variant="caption" color="text.secondary">{group.players.length} players</Typography>
        </Stack>
        {group.players.map((player, index) => (
          <Stack
            key={player.id}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: index === group.players.length - 1 ? 0 : '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Link
                component={RouterLink}
                to={`/players/${player.id}`}
                underline="hover"
                sx={{ fontWeight: player.starter ? 600 : 400 }}
              >
                {player.first} {player.last}
              </Link>
              <Typography variant="caption" color="text.secondary" display="block">
                {PLAYER_YEAR_LABELS[player.year]}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">Rating</Typography>
              <Typography sx={{ fontWeight: 700 }}>{player.rating}</Typography>
            </Box>
            {player.starter ? (
              <Chip label="Starter" size="small" color="success" variant="outlined" />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ width: 46 }}>
                Backup
              </Typography>
            )}
          </Stack>
        ))}
      </Paper>
    ))}
  </Stack>
);
