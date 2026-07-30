import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
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
import type { RosterCutPlayerPreview } from '../../types/roster';

interface RosterSelectionPanelProps {
  players: RosterCutPlayerPreview[];
  filtered: boolean;
  busyPlayerId: number | null;
  onSelect: (playerId: number) => void;
  onUndo: (playerId: number) => void;
}

const blockedReason = (
  reason: RosterCutPlayerPreview['blockedReason'],
) => {
  switch (reason) {
    case 'FRESHMAN_PROTECTED':
      return 'Freshman protected';
    case 'CUTS_COMPLETE':
      return 'Required cuts complete';
    case 'STARTER_MINIMUM':
      return 'Would violate starter minimum';
    default:
      return '';
  }
};

const PlayerLink = ({ player }: { player: RosterCutPlayerPreview }) => (
  <Link
    component={RouterLink}
    to={`/players/${player.id}`}
    underline="hover"
    sx={{ fontWeight: 700 }}
  >
    {player.first} {player.last}
  </Link>
);

const Status = ({ player }: { player: RosterCutPlayerPreview }) => {
  if (player.selected) {
    return <Chip label="Selected" size="small" color="warning" />;
  }
  if (player.protected) {
    return <Chip label="Protected" size="small" color="success" variant="outlined" />;
  }
  if (player.recommended) {
    return <Chip label="Recommended" size="small" color="primary" variant="outlined" />;
  }
  if (player.blockedReason) {
    return (
      <Chip
        label={blockedReason(player.blockedReason)}
        size="small"
        color="warning"
        variant="outlined"
      />
    );
  }
  return <Chip label="Available" size="small" variant="outlined" />;
};

export const RosterSelectionPanel = ({
  players,
  filtered,
  busyPlayerId,
  onSelect,
  onUndo,
}: RosterSelectionPanelProps) => (
  <Paper
    component="section"
    aria-labelledby="roster-selection-title"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography id="roster-selection-title" component="h2" variant="h6">
        Active Roster
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {players.length} player{players.length === 1 ? '' : 's'} shown. Freshmen are protected;
        recommendations prioritize roster balance, current ability, and remaining eligibility.
      </Typography>
    </Box>
    {players.length === 0 ? (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">
          {filtered ? 'No players match these filters' : 'No active roster'}
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
          <Table stickyHeader size="small" aria-label="Roster cut selection">
            <TableHead>
              <TableRow>
                <TableCell>Player</TableCell>
                <TableCell>Pos</TableCell>
                <TableCell>Class</TableCell>
                <TableCell align="right">Current</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map(player => (
                <TableRow key={player.id} hover>
                  <TableCell>
                    <PlayerLink player={player} />
                  </TableCell>
                  <TableCell>{player.position.toUpperCase()}</TableCell>
                  <TableCell>{player.currentClass.toUpperCase()}</TableCell>
                  <TableCell align="right">{player.currentRating}</TableCell>
                  <TableCell>
                    <Status player={player} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color={player.selected ? 'inherit' : 'warning'}
                      onClick={() =>
                        player.selected
                          ? onUndo(player.id)
                          : onSelect(player.id)
                      }
                      disabled={
                        busyPlayerId !== null ||
                        (!player.selected && !player.canSelect)
                      }
                      title={
                        player.selected
                          ? 'Undo this cut'
                          : blockedReason(player.blockedReason)
                      }
                    >
                      {busyPlayerId === player.id
                        ? 'Saving…'
                        : player.selected
                          ? 'Undo'
                          : 'Select'}
                    </Button>
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
                py: 1.15,
                borderBottom: index === players.length - 1 ? 0 : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <PlayerLink player={player} />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {player.position.toUpperCase()} · {player.currentClass.toUpperCase()} · Current{' '}
                  {player.currentRating}
                </Typography>
                <Status player={player} />
              </Box>
              <Button
                size="small"
                color={player.selected ? 'inherit' : 'warning'}
                onClick={() =>
                  player.selected ? onUndo(player.id) : onSelect(player.id)
                }
                disabled={
                  busyPlayerId !== null ||
                  (!player.selected && !player.canSelect)
                }
                aria-label={
                  player.selected
                    ? `Undo cut for ${player.first} ${player.last}`
                    : `Select ${player.first} ${player.last} for a cut`
                }
              >
                {busyPlayerId === player.id
                  ? 'Saving…'
                  : player.selected
                    ? 'Undo'
                    : 'Select'}
              </Button>
            </Stack>
          ))}
        </Stack>
      </>
    )}
  </Paper>
);
