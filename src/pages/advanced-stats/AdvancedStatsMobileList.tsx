import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import {
  ADVANCED_METRIC_COLUMNS,
  formatAdvancedMetric,
} from './config';
import { PollCalculationBreakdown } from './PollCalculationBreakdown';
import type { AdvancedStatsViewProps } from './types';

export const AdvancedStatsMobileList = ({
  rows,
  mode,
  sortKey,
  onTeamClick,
}: AdvancedStatsViewProps) => {
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const columns = ADVANCED_METRIC_COLUMNS[mode];
  const selectedColumn = mode === 'poll' && sortKey === 'pollRank'
    ? columns.find(column => column.key === 'pollScore')!
    : columns.find(column => column.key === sortKey) ?? columns[0];
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={`${mode} advanced statistics`}
      sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
    >
      {rows.map((row, index) => {
        const expanded = row.teamId === expandedTeamId;
        return (
          <Box
            key={row.teamId}
            sx={{ borderBottom: index === rows.length - 1 ? 0 : '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 1.25 }}>
              <Typography sx={{ width: 28, textAlign: 'center', fontWeight: 700 }}>
                {mode === 'poll' ? row.pollRank : index + 1}
              </Typography>
              <TeamLogo name={row.teamName} size={34} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <TeamLink name={row.teamName} onTeamClick={onTeamClick} />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {row.record} · {row.games} {row.games === 1 ? 'game' : 'games'}
                </Typography>
                {mode === 'poll' && row.pollRankOverrideReason && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {row.pollRankOverrideReason === 'playoff_selection'
                      ? 'Playoff selection rank override'
                      : 'Championship placement rank override'}
                  </Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {formatAdvancedMetric(row, mode, selectedColumn.key)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {selectedColumn.mobileLabel}
                </Typography>
                {selectedColumn.key === 'pollScore' && !row.pollScoreMatchesProjection && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Proj. {row.projectedPollScore.toFixed(1)}
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                aria-label={`${expanded ? 'Hide' : 'Show'} ${row.teamName} ${mode === 'poll' ? 'poll calculation' : 'advanced statistics'}`}
                aria-expanded={expanded}
                onClick={() => setExpandedTeamId(expanded ? null : row.teamId)}
              >
                <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '150ms' }} />
              </IconButton>
            </Stack>
            <Collapse in={expanded}>
              <Box sx={{ px: 1.5, pb: 1.5 }}>
                {mode === 'poll' && (
                  <Box sx={{ mb: 0.75 }}>
                    <PollCalculationBreakdown row={row} />
                  </Box>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
                  {columns.map(column => (
                    <Box key={column.key} sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {column.mobileLabel}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatAdvancedMetric(row, mode, column.key)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Paper>
  );
};
