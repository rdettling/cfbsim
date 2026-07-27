import { Fragment } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Chip,
  Link,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { DataTable } from '../../components/ui/DataTable';
import { PLAYER_YEAR_LABELS } from './config';
import type { RosterViewProps } from './types';

export const RosterDesktopTable = ({ groups }: RosterViewProps) => (
  <DataTable ariaLabel="Team roster" minWidth={720}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell>Player</TableCell>
        <TableCell align="right" sx={{ width: 110 }}>Rating</TableCell>
        <TableCell sx={{ width: 160 }}>Class</TableCell>
        <TableCell sx={{ width: 120 }}>Role</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {groups.map(group => (
        <Fragment key={group.position}>
          <TableRow>
            <TableCell
              colSpan={4}
              sx={{ py: 0.75, bgcolor: 'action.hover', fontWeight: 600 }}
            >
              {group.position.toUpperCase()}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {group.players.length} {group.players.length === 1 ? 'player' : 'players'}
              </Typography>
            </TableCell>
          </TableRow>
          {group.players.map(player => (
            <TableRow key={player.id} hover>
              <TableCell>
                <Link
                  component={RouterLink}
                  to={`/players/${player.id}`}
                  underline="hover"
                  sx={{ fontWeight: player.starter ? 600 : 400 }}
                >
                  {player.first} {player.last}
                </Link>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{player.rating}</TableCell>
              <TableCell>{PLAYER_YEAR_LABELS[player.year]}</TableCell>
              <TableCell>
                {player.starter ? (
                  <Chip label="Starter" size="small" color="success" variant="outlined" />
                ) : (
                  <Typography variant="body2" color="text.secondary">Backup</Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </Fragment>
      ))}
    </TableBody>
  </DataTable>
);
