import { Fragment, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import {
  ADVANCED_METRIC_COLUMNS,
  formatAdvancedMetric,
} from './config';
import { PollCalculationBreakdown } from './PollCalculationBreakdown';
import type { AdvancedStatsViewProps } from './types';

export const AdvancedStatsDesktopTable = ({
  rows,
  mode,
  sortKey,
  sortDirection,
  onSort,
  onTeamClick,
}: AdvancedStatsViewProps) => {
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const columns = ADVANCED_METRIC_COLUMNS[mode];
  return (
    <DataTable
      ariaLabel={`${mode} advanced statistics`}
      minWidth={mode === 'poll' ? 1240 : mode === 'performance' ? 980 : 1660}
    >
      <TableHead>
        <TableRow>
          <TableCell
            align="center"
            sortDirection={mode === 'poll' && sortKey === 'pollRank' ? sortDirection : false}
            sx={{ width: mode === 'poll' ? 92 : 64, whiteSpace: 'nowrap' }}
          >
            {mode === 'poll' ? (
              <TableSortLabel
                active={sortKey === 'pollRank'}
                direction={sortKey === 'pollRank' ? sortDirection : 'asc'}
                onClick={() => onSort('pollRank')}
              >
                Poll Rank
              </TableSortLabel>
            ) : 'Rank'}
          </TableCell>
          <TableCell sx={{ minWidth: 210 }}>Team</TableCell>
          <TableCell align="center" sx={{ width: 90, whiteSpace: 'nowrap' }}>Record</TableCell>
          {columns.map(column => (
            <TableCell
              key={column.key}
              align="right"
              sortDirection={sortKey === column.key ? sortDirection : false}
              sx={{ minWidth: column.width, whiteSpace: 'nowrap' }}
            >
              <Tooltip title={column.description} arrow>
                <TableSortLabel
                  active={sortKey === column.key}
                  direction={sortKey === column.key ? sortDirection : column.direction}
                  onClick={() => onSort(column.key)}
                >
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    {column.label}
                    <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  </Box>
                </TableSortLabel>
              </Tooltip>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => {
          const expanded = mode === 'poll' && row.teamId === expandedTeamId;
          return (
            <Fragment key={row.teamId}>
              <TableRow hover>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {mode === 'poll' ? row.pollRank : index + 1}
                  {mode === 'poll' && row.pollRankOverrideReason && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', fontWeight: 400 }}
                    >
                      {row.pollRankOverrideReason === 'playoff_selection'
                        ? 'Playoff'
                        : 'Championship'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {mode === 'poll' && (
                      <IconButton
                        size="small"
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${row.teamName} poll calculation`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedTeamId(expanded ? null : row.teamId)}
                      >
                        <ExpandMoreIcon sx={{
                          transform: expanded ? 'rotate(180deg)' : 'none',
                          transition: '150ms',
                        }} />
                      </IconButton>
                    )}
                    <TeamLogo name={row.teamName} size={30} />
                    <TeamLink name={row.teamName} onTeamClick={onTeamClick} />
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{row.record}</TableCell>
                {columns.map(column => (
                  <TableCell
                    key={column.key}
                    align="right"
                    sx={sortKey === column.key ? { fontWeight: 700, bgcolor: 'action.hover' } : undefined}
                  >
                    {formatAdvancedMetric(row, mode, column.key)}
                    {column.key === 'pollScore' && !row.pollScoreMatchesProjection && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Proj. {row.projectedPollScore.toFixed(1)}
                      </Typography>
                    )}
                  </TableCell>
                ))}
              </TableRow>
              {expanded && (
                <TableRow>
                  <TableCell colSpan={3 + columns.length} sx={{ p: 1 }}>
                    <PollCalculationBreakdown row={row} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </DataTable>
  );
};
