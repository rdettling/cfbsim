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
import type { ReturningPlayerPreview } from '../../types/roster';

interface ReturningPlayersPanelProps {
  players: ReturningPlayerPreview[];
  filtered: boolean;
}

const formatSigned = (value: number) =>
  value > 0 ? `+${value}` : String(value);

const PlayerLink = ({ player }: { player: ReturningPlayerPreview }) => (
  <Link
    component={RouterLink}
    to={`/players/${player.id}`}
    underline="hover"
    sx={{ fontWeight: 600 }}
  >
    {player.first} {player.last}
  </Link>
);

export const ReturningPlayersPanel = ({
  players,
  filtered,
}: ReturningPlayersPanelProps) => (
  <Paper
    component="section"
    aria-labelledby="returning-players-title"
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
      alignItems="flex-start"
      justifyContent="space-between"
      spacing={1}
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box>
        <Typography id="returning-players-title" component="h2" variant="h6">
          Returning Players
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Projected class and rating changes
        </Typography>
      </Box>
      <Chip label={players.length} size="small" variant="outlined" />
    </Stack>

    {players.length === 0 ? (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {filtered ? 'No returning players at this position' : 'No returning players'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filtered
            ? 'Choose another position to view projected progression.'
            : 'No active underclassmen are available to progress.'}
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
          <Table stickyHeader size="small" aria-label="Returning player projections">
            <TableHead>
              <TableRow>
                <TableCell>Player</TableCell>
                <TableCell>Pos</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map(player => (
                <TableRow key={player.id} hover>
                  <TableCell><PlayerLink player={player} /></TableCell>
                  <TableCell>{player.position.toUpperCase()}</TableCell>
                  <TableCell>
                    {player.currentClass.toUpperCase()} →{' '}
                    {player.projectedClass.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    {player.currentRating} → {player.projectedRating}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        player.ratingChange > 0
                          ? 'success.main'
                          : player.ratingChange < 0
                            ? 'error.main'
                            : 'text.secondary',
                      fontWeight: 700,
                    }}
                  >
                    {formatSigned(player.ratingChange)}
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
            <Box
              component="article"
              key={player.id}
              sx={{
                px: 1.5,
                py: 1.25,
                borderBottom:
                  index === players.length - 1 ? 0 : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  <PlayerLink player={player} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    {player.position.toUpperCase()} ·{' '}
                    {player.currentClass.toUpperCase()} →{' '}
                    {player.projectedClass.toUpperCase()}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {player.currentRating} → {player.projectedRating}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={
                      player.ratingChange > 0
                        ? 'success.main'
                        : player.ratingChange < 0
                          ? 'error.main'
                          : 'text.secondary'
                    }
                  >
                    {formatSigned(player.ratingChange)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </>
    )}
  </Paper>
);
