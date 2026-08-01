import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, IconButton, Link, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { formatIndividualStat } from './config';
import type { IndividualStatsViewProps } from './types';

export const IndividualStatsMobileList = ({
  rows,
  columns,
  sortKey,
  onTeamClick,
}: IndividualStatsViewProps) => {
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  const selectedColumn = columns.find((column) => column.key === sortKey) ?? columns[0];

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Individual statistics"
      sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
    >
      {rows.map((row, index) => {
        const expanded = expandedPlayer === row.id;
        return (
          <Box
            key={row.id}
            sx={{
              borderBottom: index === rows.length - 1 ? 0 : '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                p: 1.25,
              }}
            >
              <Typography sx={{ width: 28, textAlign: 'center', fontWeight: 600 }}>
                {row.rank}
              </Typography>
              <TeamLogo name={row.team} size={34} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`/players/${row.id}`}
                  underline="hover"
                  sx={{ fontWeight: 600 }}
                >
                  {row.first} {row.last}
                </Link>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                    }}
                  >
                    {row.pos} ·
                  </Typography>
                  <TeamLink name={row.team} onTeamClick={onTeamClick} />
                </Stack>
              </Box>
              <Box sx={{ width: 64, flexShrink: 0, textAlign: 'right' }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  {selectedColumn.label}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {formatIndividualStat(row.stats[sortKey] ?? 0, selectedColumn)}
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
                <Box sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Games
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.gamesPlayed}
                  </Typography>
                </Box>
                {columns.map((column) => (
                  <Box key={column.key} sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        display: 'block',
                      }}
                    >
                      {column.mobileLabel}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatIndividualStat(row.stats[column.key] ?? 0, column)}
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
