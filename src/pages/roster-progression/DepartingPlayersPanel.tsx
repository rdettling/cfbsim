import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Chip,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DepartingPlayerPreview } from '../../types/roster';

interface DepartingPlayersPanelProps {
  players: DepartingPlayerPreview[];
  filtered: boolean;
}

const PlayerLink = ({ player }: { player: DepartingPlayerPreview }) => (
  <Link
    component={RouterLink}
    to={`/players/${player.id}`}
    underline="hover"
    sx={{ fontWeight: 600 }}
  >
    {player.first} {player.last}
  </Link>
);

export const DepartingPlayersPanel = ({ players, filtered }: DepartingPlayersPanelProps) => (
  <Paper
    component="section"
    aria-labelledby="departing-players-title"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box>
        <Typography id="departing-players-title" component="h2" variant="h6">
          Departing Seniors
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          Players projected to graduate
        </Typography>
      </Box>
      <Chip label={players.length} size="small" variant="outlined" />
    </Stack>

    {players.length === 0 ? (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {filtered ? 'No departing seniors at this position' : 'No departing seniors'}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {filtered
            ? 'Choose another position to view projected departures.'
            : 'This roster has no active seniors.'}
        </Typography>
      </Box>
    ) : (
      <>
        <TableContainer
          sx={{
            display: { xs: 'none', lg: 'block' },
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <Table stickyHeader size="small" aria-label="Departing senior projections">
            <TableHead>
              <TableRow>
                <TableCell>Player</TableCell>
                <TableCell>Pos</TableCell>
                <TableCell align="right">Rating</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id} hover>
                  <TableCell>
                    <PlayerLink player={player} />
                  </TableCell>
                  <TableCell>{player.position.toUpperCase()}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {player.currentRating}
                  </TableCell>
                  <TableCell>
                    <Chip label="Graduates" size="small" color="warning" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack
          sx={{
            display: { xs: 'flex', lg: 'none' },
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {players.map((player, index) => (
            <Stack
              component="article"
              key={player.id}
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                px: 1.5,
                py: 1.25,

                borderBottom: index === players.length - 1 ? 0 : '1px solid',

                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <PlayerLink player={player} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  {player.position.toUpperCase()} · Senior · Rating {player.currentRating}
                </Typography>
              </Box>
              <Chip label="Graduates" size="small" color="warning" variant="outlined" />
            </Stack>
          ))}
        </Stack>
      </>
    )}
  </Paper>
);
