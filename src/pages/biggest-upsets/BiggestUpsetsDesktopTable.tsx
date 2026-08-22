import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Chip,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { DataTable } from '../../components/ui/DataTable';
import type { BiggestUpsetGame } from '../../domain/league/loaders/biggestUpsets';
import {
  formatOvertime,
  formatUpsetProbability,
  formatUpsetScore,
} from './presentation';
import { UpsetTeamIdentity } from './UpsetTeamIdentity';

export const BiggestUpsetsDesktopTable = ({
  upsets,
  onTeamClick,
}: {
  upsets: BiggestUpsetGame[];
  onTeamClick: (name: string) => void;
}) => (
  <DataTable ariaLabel="Biggest upsets" minWidth={980}>
    <TableHead>
      <TableRow>
        <TableCell sx={{ width: 76 }}>Week</TableCell>
        <TableCell sx={{ minWidth: 220 }}>Winner</TableCell>
        <TableCell align="center" sx={{ width: 96 }}>Final</TableCell>
        <TableCell sx={{ minWidth: 220 }}>Loser</TableCell>
        <TableCell align="right" sx={{ width: 150 }}>Pregame Chance</TableCell>
        <TableCell sx={{ minWidth: 190 }}>Context</TableCell>
        <TableCell align="right" sx={{ width: 100 }}>Game</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {upsets.map(upset => {
        const overtime = formatOvertime(upset.overtime);
        return (
          <TableRow key={upset.gameId} hover>
            <TableCell sx={{ fontWeight: 700 }}>{upset.week}</TableCell>
            <TableCell>
              <UpsetTeamIdentity team={upset.winner} onTeamClick={onTeamClick} />
            </TableCell>
            <TableCell align="center">
              <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatUpsetScore(upset)}
              </Typography>
              {overtime && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {overtime}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <UpsetTeamIdentity team={upset.loser} onTeamClick={onTeamClick} />
            </TableCell>
            <TableCell align="right">
              <Chip
                label={formatUpsetProbability(upset.winnerWinProbability)}
                size="small"
                color="warning"
                variant="outlined"
              />
            </TableCell>
            <TableCell>{upset.label}</TableCell>
            <TableCell align="right">
              <Button component={RouterLink} to={`/game/${upset.gameId}`} size="small">
                Summary
              </Button>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </DataTable>
);
