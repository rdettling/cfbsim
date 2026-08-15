import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  Box,
  Chip,
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
import {
  formatLeagueRecordValue,
  LEAGUE_RECORDS_COLUMNS,
} from './config';
import type { LeagueRecordsViewProps } from './types';

const rankCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  width: 58,
  minWidth: 58,
  bgcolor: 'background.paper',
};

const programCellSx = {
  position: 'sticky',
  left: 58,
  zIndex: 2,
  width: 230,
  minWidth: 230,
  bgcolor: 'background.paper',
};

export const LeagueRecordsDesktopTable = ({
  rows,
  sortKey,
  sortDirection,
  onSort,
  onTeamClick,
}: LeagueRecordsViewProps) => (
  <DataTable ariaLabel="League records" minWidth={1690}>
    <TableHead>
      <TableRow sx={{ '& th': { top: 0, height: 34, py: 0.5, bgcolor: 'background.default', zIndex: 4 } }}>
        <TableCell colSpan={3}>Program</TableCell>
        <TableCell colSpan={6} align="center">Completed Seasons</TableCell>
        <TableCell colSpan={5} align="center">Dynasty Honors</TableCell>
      </TableRow>
      <TableRow sx={{ '& th': { top: 34, bgcolor: 'background.default', zIndex: 3 } }}>
        <TableCell align="center" sx={{ ...rankCellSx, zIndex: 5, bgcolor: 'background.default' }}>
          Rank
        </TableCell>
        <TableCell sx={{ ...programCellSx, zIndex: 5, bgcolor: 'background.default' }}>
          Program
        </TableCell>
        <TableCell sx={{ minWidth: 120 }}>Conference</TableCell>
        {LEAGUE_RECORDS_COLUMNS.map(column => (
          <TableCell
            key={column.key}
            align="right"
            sortDirection={sortKey === column.key ? sortDirection : false}
            sx={{ width: column.width, minWidth: column.width, whiteSpace: 'nowrap' }}
          >
            <TableSortLabel
              active={sortKey === column.key}
              direction={sortKey === column.key ? sortDirection : 'desc'}
              onClick={() => onSort(column.key)}
              IconComponent={sortDirection === 'desc' ? ArrowDownwardIcon : ArrowUpwardIcon}
            >
              {column.label}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map(row => (
        <TableRow key={row.name} hover>
          <TableCell align="center" sx={{ ...rankCellSx, fontWeight: 600 }}>
            {row.rank}
          </TableCell>
          <TableCell sx={programCellSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamLogo name={row.name} size={30} />
              <Box sx={{ minWidth: 0 }}>
                {row.active ? (
                  <TeamLink name={row.name} onTeamClick={onTeamClick} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.name}
                  </Typography>
                )}
                {!row.active && <Chip label="Historical" size="small" variant="outlined" sx={{ mt: 0.5, height: 20 }} />}
              </Box>
            </Box>
          </TableCell>
          <TableCell>{row.conference}</TableCell>
          {LEAGUE_RECORDS_COLUMNS.map(column => (
            <TableCell
              key={column.key}
              align="right"
              sx={column.key === sortKey ? { fontWeight: 700, bgcolor: 'action.hover' } : undefined}
            >
              {formatLeagueRecordValue(row, column.key)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
