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
import type { RosterCutPlayerPreview } from '../../types/roster';

interface ProjectedCutsPanelProps {
  cuts: RosterCutPlayerPreview[];
  selectedPosition: string;
  totalCuts: number;
}

const PlayerLink = ({
  player,
}: {
  player: RosterCutPlayerPreview;
}) => (
  <Link
    component={RouterLink}
    to={`/players/${player.id}`}
    underline="hover"
    sx={{ fontWeight: 600 }}
  >
    {player.first} {player.last}
  </Link>
);

export const ProjectedCutsPanel = ({
  cuts,
  selectedPosition,
  totalCuts,
}: ProjectedCutsPanelProps) => {
  const title = selectedPosition
    ? `${selectedPosition.toUpperCase()} Projected Cuts`
    : 'Projected Cuts';
  const emptyTitle =
    totalCuts === 0
      ? 'No cuts needed'
      : selectedPosition
        ? `${selectedPosition.toUpperCase()} is within its limit`
        : 'No projected cuts';

  return (
    <Paper
      component="section"
      aria-labelledby="projected-cuts-title"
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
          <Typography
            id="projected-cuts-title"
            component="h2"
            variant="h6"
          >
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Retained by senior rating, current rating, class
            seniority, then lowest player ID.
          </Typography>
        </Box>
        <Chip label={cuts.length} size="small" variant="outlined" />
      </Stack>

      {cuts.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {emptyTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedPosition
              ? 'Select another position or select this position again to show all cuts.'
              : 'Your roster is within every configured position limit.'}
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
            <Table stickyHeader size="small" aria-label={title}>
              <TableHead>
                <TableRow>
                  <TableCell>Player</TableCell>
                  <TableCell>Pos</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell align="right">Current</TableCell>
                  <TableCell align="right">Senior</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuts.map(player => (
                  <TableRow key={player.id} hover>
                    <TableCell>
                      <PlayerLink player={player} />
                    </TableCell>
                    <TableCell>
                      {player.position.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {player.currentClass.toUpperCase()}
                    </TableCell>
                    <TableCell align="right">
                      {player.currentRating}
                    </TableCell>
                    <TableCell align="right">
                      {player.seniorRating}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label="Projected Cut"
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
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
            {cuts.map((player, index) => (
              <Stack
                component="article"
                key={player.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderBottom:
                    index === cuts.length - 1 ? 0 : '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <PlayerLink player={player} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    {player.position.toUpperCase()} ·{' '}
                    {player.currentClass.toUpperCase()} · Current{' '}
                    {player.currentRating} · Senior{' '}
                    {player.seniorRating}
                  </Typography>
                </Box>
                <Chip
                  label="Projected Cut"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );
};
