import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import { ConfLogo } from '../../components/team/TeamComponents';
import { rankLabel, type TeamHistoryViewProps } from './types';

export const TeamHistoryMobileList = ({
  years,
  teamName,
}: TeamHistoryViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={`${teamName} team history`}
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {years.map((year, index) => (
      <Box
        key={year.year}
        sx={{ p: 1.5, borderBottom: index === years.length - 1 ? 0 : '1px solid', borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {year.has_games ? (
            <Link component={RouterLink} to={`/${teamName}/schedule/${year.year}`} variant="h6" underline="hover">
              {year.year}
            </Link>
          ) : (
            <Typography variant="h6">{year.year}</Typography>
          )}
          <Typography variant="h6">{year.wins}-{year.losses}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          <Chip label={`Tier ${year.prestige}`} size="small" variant="outlined" />
          <Chip label={`Rating ${year.rating ?? '—'}`} size="small" variant="outlined" />
          {year.rank === 1 ? (
            <Chip icon={<EmojiEventsIcon />} label="Champion" size="small" color="warning" variant="outlined" />
          ) : (
            <Chip label={rankLabel(year.rank)} size="small" variant="outlined" />
          )}
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
          {year.conference !== 'Independent' && <ConfLogo name={year.conference} size={24} />}
          <Typography variant="body2" color="text.secondary">{year.conference}</Typography>
        </Stack>
      </Box>
    ))}
  </Paper>
);
