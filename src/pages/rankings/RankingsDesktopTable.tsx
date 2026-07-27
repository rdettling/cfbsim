import {
  Box,
  Chip,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { CompactGameSummary } from '../../components/game/CompactGameSummary';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import { DataTable } from '../../components/ui/DataTable';
import type { RankingsViewProps } from './types';

const RankingMovement = ({ movement }: { movement: number }) => {
  if (movement === 0) {
    return (
      <Typography
        variant="body2"
        aria-label="No rank change"
        sx={{
          color: 'text.secondary',
        }}
      >
        —
      </Typography>
    );
  }

  const amount = Math.abs(movement);

  return (
    <Chip
      label={`${movement > 0 ? '+' : ''}${movement}`}
      size="small"
      color={movement > 0 ? 'success' : 'error'}
      variant="outlined"
      aria-label={`${movement > 0 ? 'Up' : 'Down'} ${amount} ${amount === 1 ? 'place' : 'places'}`}
    />
  );
};

export const RankingsDesktopTable = ({ teams, onTeamClick }: RankingsViewProps) => (
  <DataTable ariaLabel="College football rankings" minWidth={1100}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ width: 112 }}>Rank</TableCell>
        <TableCell sx={{ minWidth: 210 }}>Team</TableCell>
        <TableCell sx={{ width: 100 }}>Record</TableCell>
        <TableCell align="right" sx={{ width: 110 }}>
          Poll
        </TableCell>
        <TableCell align="right" sx={{ width: 110 }}>
          SOR
        </TableCell>
        <TableCell sx={{ minWidth: 230 }}>Last Week</TableCell>
        <TableCell sx={{ minWidth: 230 }}>This Week</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {teams.map((team) => (
        <TableRow key={team.name} hover>
          <TableCell>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {team.ranking}
              </Typography>
              <RankingMovement movement={team.movement} />
            </Stack>
          </TableCell>
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamLogo name={team.name} size={30} />
              <TeamLink name={team.name} onTeamClick={onTeamClick} />
            </Box>
          </TableCell>
          <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{team.record}</TableCell>
          <TableCell align="right">
            {team.poll_score !== undefined ? team.poll_score.toFixed(1) : '—'}
          </TableCell>
          <TableCell align="right">
            {team.strength_of_record !== undefined ? team.strength_of_record.toFixed(1) : '—'}
          </TableCell>
          <TableCell>
            <CompactGameSummary
              game={team.last_game}
              mode="previous"
              onOpponentClick={onTeamClick}
            />
          </TableCell>
          <TableCell>
            <CompactGameSummary
              game={team.next_game}
              mode="upcoming"
              onOpponentClick={onTeamClick}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
