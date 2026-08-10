import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, IconButton, Link, Paper, Stack, Typography } from '@mui/material';
import { formatTeamPlayerStat } from './config';
import type { TeamPlayerStatsViewProps } from './types';

export const TeamPlayerStatsMobileList = ({
  rows,
  columns,
  sortKey,
}: TeamPlayerStatsViewProps) => {
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  const selectedColumn = columns.find(column => column.sortKey === sortKey) ?? columns[0];

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Team player statistics"
      sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
    >
      {rows.map((row, index) => {
        const expanded = expandedPlayer === row.id;
        return (
          <Box
            key={row.id}
            sx={{ borderBottom: index === rows.length - 1 ? 0 : '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 1.25 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`/players/${row.id}`}
                  underline="hover"
                  sx={{ fontWeight: 600 }}
                >
                  {row.first} {row.last}
                </Link>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', textTransform: 'uppercase' }}
                >
                  {row.pos}
                </Typography>
              </Box>
              <Box sx={{ minWidth: 72, flexShrink: 0, textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {selectedColumn.label}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {formatTeamPlayerStat(row.stats, selectedColumn)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label={`${expanded ? 'Hide' : 'Show'} ${row.first} ${row.last} statistics`}
                aria-expanded={expanded}
                onClick={() => setExpandedPlayer(expanded ? null : row.id)}
              >
                <ExpandMoreIcon
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 150ms',
                  }}
                />
              </IconButton>
            </Stack>
            <Collapse in={expanded}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 0.75,
                  px: 1.5,
                  pb: 1.5,
                }}
              >
                {columns.map(column => (
                  <Box key={column.key} sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {column.mobileLabel}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatTeamPlayerStat(row.stats, column)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Paper>
  );
};
