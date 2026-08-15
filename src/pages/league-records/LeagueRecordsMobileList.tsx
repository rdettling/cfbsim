import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { formatLeagueRecordValue, getLeagueRecordsColumn } from './config';
import type { LeagueRecordsViewProps } from './types';

export const LeagueRecordsMobileList = ({
  rows,
  sortKey,
  onTeamClick,
}: LeagueRecordsViewProps) => {
  const column = getLeagueRecordsColumn(sortKey);
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="League records"
      sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
    >
      {rows.map((row, index) => (
        <Stack
          key={row.name}
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            p: 1.25,
            borderBottom: index === rows.length - 1 ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ width: 28, textAlign: 'center', fontWeight: 700 }}>
            {row.rank}
          </Typography>
          <TeamLogo name={row.name} size={34} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              {row.active ? (
                <TeamLink name={row.name} onTeamClick={onTeamClick} />
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {row.name}
                </Typography>
              )}
              {!row.active && <Chip label="Historical" size="small" variant="outlined" sx={{ height: 20 }} />}
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {row.conference} · {row.wins}–{row.losses} · {row.seasons} season{row.seasons === 1 ? '' : 's'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', pl: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {column.mobileLabel}
            </Typography>
            <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {formatLeagueRecordValue(row, sortKey)}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Paper>
  );
};
