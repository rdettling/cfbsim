import { Link as RouterLink } from 'react-router-dom';
import {
  Link,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { DataTable } from '../../components/ui/DataTable';
import { formatTeamPlayerStat } from './config';
import type { TeamPlayerStatsViewProps } from './types';

const playerCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  width: 220,
  minWidth: 220,
  bgcolor: 'background.paper',
};

export const TeamPlayerStatsDesktopTable = ({
  rows,
  columns,
  sortKey,
  sortDirection,
  onSort,
}: TeamPlayerStatsViewProps) => (
  <DataTable ariaLabel="Team player statistics" minWidth={760}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ ...playerCellSx, zIndex: 4, bgcolor: 'background.default' }}>
          Player
        </TableCell>
        <TableCell align="center" sx={{ width: 72 }}>Pos</TableCell>
        {columns.map(column => (
          <TableCell
            key={column.key}
            align="right"
            sortDirection={sortKey === column.sortKey ? sortDirection : false}
            sx={{ minWidth: 86, whiteSpace: 'nowrap' }}
          >
            <TableSortLabel
              active={sortKey === column.sortKey}
              direction={sortKey === column.sortKey ? sortDirection : 'desc'}
              onClick={() => onSort(column.sortKey)}
            >
              {column.label}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map(row => (
        <TableRow key={row.id} hover>
          <TableCell sx={playerCellSx}>
            <Link
              component={RouterLink}
              to={`/players/${row.id}`}
              underline="hover"
              sx={{ fontWeight: 600 }}
            >
              {row.first} {row.last}
            </Link>
          </TableCell>
          <TableCell align="center">
            <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>
              {row.pos}
            </Typography>
          </TableCell>
          {columns.map(column => (
            <TableCell
              key={column.key}
              align="right"
              sx={sortKey === column.sortKey ? { fontWeight: 600, bgcolor: 'action.hover' } : undefined}
            >
              {formatTeamPlayerStat(row.stats, column)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
