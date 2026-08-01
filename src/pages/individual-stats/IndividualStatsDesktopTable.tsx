import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Link,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import { formatIndividualStat } from './config';
import type { IndividualStatsViewProps } from './types';

const rankCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  width: 62,
  minWidth: 62,
  bgcolor: 'background.paper',
};
const playerCellSx = {
  position: 'sticky',
  left: 62,
  zIndex: 2,
  width: 190,
  minWidth: 190,
  bgcolor: 'background.paper',
};
const teamCellSx = {
  position: 'sticky',
  left: 252,
  zIndex: 2,
  width: 190,
  minWidth: 190,
  bgcolor: 'background.paper',
};

export const IndividualStatsDesktopTable = ({
  rows,
  columns,
  sortKey,
  sortDirection,
  onSort,
  onTeamClick,
}: IndividualStatsViewProps) => (
  <DataTable ariaLabel="Individual statistics" minWidth={1120}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell align="center" sx={{ ...rankCellSx, zIndex: 4, bgcolor: 'background.default' }}>Rank</TableCell>
        <TableCell sx={{ ...playerCellSx, zIndex: 4, bgcolor: 'background.default' }}>Player</TableCell>
        <TableCell sx={{ ...teamCellSx, zIndex: 4, bgcolor: 'background.default' }}>Team</TableCell>
        <TableCell align="center" sx={{ width: 64 }}>Pos</TableCell>
        <TableCell align="right" sx={{ width: 64 }}>G</TableCell>
        {columns.map(column => (
          <TableCell
            key={column.key}
            align="right"
            sortDirection={sortKey === column.key ? sortDirection : false}
            sx={{ minWidth: 82, whiteSpace: 'nowrap' }}
          >
            <TableSortLabel
              active={sortKey === column.key}
              direction={sortKey === column.key ? sortDirection : 'desc'}
              onClick={() => onSort(column.key)}
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
          <TableCell align="center" sx={{ ...rankCellSx, fontWeight: 600 }}>{row.rank}</TableCell>
          <TableCell sx={playerCellSx}>
            <Link component={RouterLink} to={`/players/${row.id}`} underline="hover" sx={{ fontWeight: 600 }}>
              {row.first} {row.last}
            </Link>
          </TableCell>
          <TableCell sx={teamCellSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamLogo name={row.team} size={28} />
              <TeamLink name={row.team} onTeamClick={onTeamClick} />
            </Box>
          </TableCell>
          <TableCell align="center">
            <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>{row.pos}</Typography>
          </TableCell>
          <TableCell align="right">{row.gamesPlayed}</TableCell>
          {columns.map(column => (
            <TableCell
              key={column.key}
              align="right"
              sx={sortKey === column.key ? { fontWeight: 600, bgcolor: 'action.hover' } : undefined}
            >
              {formatIndividualStat(row.stats[column.key] ?? 0, column)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
