import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { DataTable } from '../../components/ui/DataTable';
import {
  ScheduleGameAction,
  ScheduleGameLabel,
  ScheduleOpponent,
} from './ScheduleGameDetails';
import { getScheduleVenueLabel } from './scheduleVenue';
import type { ScheduleViewProps } from './types';

export const DesktopScheduleTable = ({ games, seasonYear, onOpponentClick }: ScheduleViewProps) => (
  <DataTable ariaLabel={`${seasonYear} season schedule`}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ width: 72 }}>Week</TableCell>
        <TableCell>Opponent</TableCell>
        <TableCell sx={{ width: 220, whiteSpace: 'nowrap' }}>Venue</TableCell>
        <TableCell align="center" sx={{ width: 110 }}>
          Moneyline
        </TableCell>
        <TableCell align="center" sx={{ width: 100 }}>
          Spread
        </TableCell>
        <TableCell align="center" sx={{ width: 124 }}>
          Result
        </TableCell>
        <TableCell sx={{ width: 220 }}>Notes</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {games.map((game) => (
        <TableRow
          key={game.weekPlayed}
          hover
          sx={game.opponent ? undefined : { bgcolor: 'action.hover' }}
        >
          <TableCell sx={{ fontWeight: 600 }}>{game.weekPlayed}</TableCell>
          {game.opponent ? (
            <>
              <TableCell>
                <ScheduleOpponent game={game} onClick={onOpponentClick} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography variant="body2">
                  {getScheduleVenueLabel(game)}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2">{game.moneyline || '—'}</Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2">{game.spread || '—'}</Typography>
              </TableCell>
              <TableCell align="center">
                <ScheduleGameAction game={game} />
              </TableCell>
              <TableCell>
                <ScheduleGameLabel game={game} />
              </TableCell>
            </>
          ) : (
            <TableCell colSpan={6}>
              <Typography
                sx={{
                  color: 'text.secondary',
                }}
              >
                Bye week
              </Typography>
            </TableCell>
          )}
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
