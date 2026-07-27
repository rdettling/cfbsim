import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import {
  formatTeamStat,
  getTeamStatColumn,
  TEAM_STAT_COLUMNS,
  TEAM_STAT_GROUPS,
} from './config';
import type { TeamStatsViewProps } from './types';

export const TeamStatsMobileList = ({
  rows,
  averages,
  sortKey,
  onTeamClick,
}: TeamStatsViewProps) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const selectedColumn = getTeamStatColumn(sortKey);

  return (
    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
      <Paper variant="outlined" sx={{ p: 1.25, mb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">League average</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedColumn.mobileLabel}: {formatTeamStat(averages, sortKey)}
          </Typography>
        </Stack>
      </Paper>
      <Paper component="section" variant="outlined" aria-label="Team statistics" sx={{ overflow: 'hidden' }}>
        {rows.map((row, index) => {
          const expanded = expandedTeam === row.teamName;
          return (
            <Box
              key={row.teamName}
              sx={{
                borderBottom: index === rows.length - 1 ? 0 : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.25 }}>
                <Typography sx={{ width: 28, textAlign: 'center', fontWeight: 600 }}>
                  {row.rank}
                </Typography>
                <TeamLogo name={row.teamName} size={34} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <TeamLink name={row.teamName} onTeamClick={onTeamClick} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    {selectedColumn.mobileLabel}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {formatTeamStat(row.stats, sortKey)}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`${expanded ? 'Hide' : 'Show'} ${row.teamName} statistics`}
                  aria-expanded={expanded}
                  onClick={() => setExpandedTeam(expanded ? null : row.teamName)}
                >
                  <ExpandMoreIcon
                    sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                  />
                </IconButton>
              </Stack>
              <Collapse in={expanded}>
                <Box sx={{ px: 1.5, pb: 1.5 }}>
                  {TEAM_STAT_GROUPS.map(group => (
                    <Box key={group} sx={{ mt: 1.25 }}>
                      <Typography variant="overline" color="text.secondary">{group}</Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 0.75,
                        }}
                      >
                        {TEAM_STAT_COLUMNS.filter(column => column.group === group).map(column => (
                          <Box key={column.key} sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {column.mobileLabel}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatTeamStat(row.stats, column.key)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Paper>
    </Box>
  );
};
