import InfoOutlined from '@mui/icons-material/InfoOutlined';
import {
  Chip,
  IconButton,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { CompactGameSummary } from '../../components/game/CompactGameSummary';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import type { RankingsViewProps } from './types';

const POLL_SCORE_EXPLANATION =
  'A 0–100 measure that begins with Team Rating, then shifts as games are played toward an Evidence Score of approximately 72.2% Résumé Score and 27.8% opponent-adjusted Performance Index. The Team Rating prior reaches zero after eight games; previous rank never affects the score. First place is not automatically 100. Playoff selection and championship placement can override score order.';

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

export const RankingsDesktopTable = ({
  teams,
  onTeamClick,
}: RankingsViewProps) => (
  <DataTable
    ariaLabel="College football rankings"
    minWidth={1160}
  >
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ width: 70 }}>Rank</TableCell>
        <TableCell sx={{ width: 100 }}>Movement</TableCell>
        <TableCell sx={{ minWidth: 230 }}>Team</TableCell>
        <TableCell sx={{ width: 100 }}>Record</TableCell>
        <TableCell align="right" sx={{ width: 170 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <span>Poll Score</span>
            <Tooltip title={POLL_SCORE_EXPLANATION} describeChild>
              <IconButton
                size="small"
                aria-label="Explain Poll Score"
                sx={{ p: 0.25 }}
              >
                <InfoOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
        <TableCell sx={{ minWidth: 230 }}>Last Week</TableCell>
        <TableCell sx={{ minWidth: 230 }}>This Week</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {teams.map((team) => (
        <TableRow key={team.name} hover>
          <TableCell>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {team.ranking}
            </Typography>
          </TableCell>
          <TableCell>
            <RankingMovement movement={team.movement} />
          </TableCell>
          <TableCell>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              <TeamLogo name={team.name} size={30} />
              <TeamLink name={team.name} onTeamClick={onTeamClick} />
              {team.isPlayoffTeam && (
                <Chip label="Playoff" size="small" color="primary" variant="outlined" />
              )}
            </Stack>
          </TableCell>
          <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{team.record}</TableCell>
          <TableCell align="right">{team.poll_score.toFixed(1)}</TableCell>
          <TableCell>
            <CompactGameSummary
              game={team.last_week}
              mode="previous"
              onOpponentClick={onTeamClick}
            />
          </TableCell>
          <TableCell>
            <CompactGameSummary
              game={team.current_week}
              mode="upcoming"
              onOpponentClick={onTeamClick}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
