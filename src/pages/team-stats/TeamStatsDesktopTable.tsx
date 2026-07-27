import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  Box,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import { DataTable } from '../../components/ui/DataTable';
import {
  formatTeamStat,
  TEAM_STAT_COLUMNS,
  TEAM_STAT_GROUPS,
} from './config';
import type { TeamStatsViewProps } from './types';

const rankCellSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  width: 64,
  minWidth: 64,
  bgcolor: 'background.paper',
};

const teamCellSx = {
  position: 'sticky',
  left: 64,
  zIndex: 2,
  width: 210,
  minWidth: 210,
  bgcolor: 'background.paper',
};

export const TeamStatsDesktopTable = ({
  rows,
  averages,
  sortKey,
  sortDirection,
  onSort,
  onTeamClick,
}: TeamStatsViewProps) => (
  <DataTable ariaLabel="Team statistics" minWidth={1740}>
    <TableHead>
      <TableRow
        sx={{
          '& th': {
            top: 0,
            height: 34,
            py: 0.5,
            bgcolor: 'background.default',
            zIndex: 4,
          },
        }}
      >
        {TEAM_STAT_GROUPS.map(group => (
          <TableCell
            key={group}
            colSpan={
              TEAM_STAT_COLUMNS.filter(column => column.group === group).length +
              (group === 'General' ? 2 : 0)
            }
            align={group === 'General' ? 'left' : 'center'}
          >
            {group}
          </TableCell>
        ))}
      </TableRow>
      <TableRow
        sx={{
          '& th': {
            top: 34,
            bgcolor: 'background.default',
            zIndex: 3,
          },
        }}
      >
        <TableCell align="center" sx={{ ...rankCellSx, zIndex: 5, bgcolor: 'background.default' }}>
          Rank
        </TableCell>
        <TableCell sx={{ ...teamCellSx, zIndex: 5, bgcolor: 'background.default' }}>
          Team
        </TableCell>
        {TEAM_STAT_COLUMNS.map(column => (
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
      <TableRow sx={{ '& td': { bgcolor: 'action.hover' } }}>
        <TableCell align="center" sx={{ ...rankCellSx, bgcolor: 'action.hover', fontWeight: 600 }}>
          AVG
        </TableCell>
        <TableCell sx={{ ...teamCellSx, bgcolor: 'action.hover' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            League Average
          </Typography>
        </TableCell>
        {TEAM_STAT_COLUMNS.map(column => (
          <TableCell key={column.key} align="right" sx={{ fontWeight: 600 }}>
            {formatTeamStat(averages, column.key)}
          </TableCell>
        ))}
      </TableRow>
      {rows.map(row => (
        <TableRow key={row.teamName} hover>
          <TableCell align="center" sx={{ ...rankCellSx, fontWeight: 600 }}>
            {row.rank}
          </TableCell>
          <TableCell sx={teamCellSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamLogo name={row.teamName} size={30} />
              <TeamLink name={row.teamName} onTeamClick={onTeamClick} />
            </Box>
          </TableCell>
          {TEAM_STAT_COLUMNS.map(column => (
            <TableCell
              key={column.key}
              align="right"
              sx={column.key === sortKey ? { fontWeight: 600, bgcolor: 'action.hover' } : undefined}
            >
              {formatTeamStat(row.stats, column.key)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
