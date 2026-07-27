import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Chip,
  Link,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ConfLogo } from '../../components/team/TeamComponents';
import { DataTable } from '../../components/ui/DataTable';
import { rankLabel, type TeamHistoryViewProps } from './types';

export const TeamHistoryDesktopTable = ({
  years,
  teamName,
}: TeamHistoryViewProps) => (
  <DataTable ariaLabel={`${teamName} team history`} minWidth={820}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ width: 110 }}>Year</TableCell>
        <TableCell sx={{ width: 130 }}>Prestige</TableCell>
        <TableCell align="right" sx={{ width: 100 }}>Rating</TableCell>
        <TableCell>Conference</TableCell>
        <TableCell align="center" sx={{ width: 120 }}>Record</TableCell>
        <TableCell align="center" sx={{ width: 150 }}>Final Rank</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {years.map(year => (
        <TableRow key={year.year} hover>
          <TableCell>
            {year.has_games ? (
              <Link
                component={RouterLink}
                to={`/${teamName}/schedule/${year.year}`}
                underline="hover"
                sx={{ fontWeight: 600 }}
              >
                {year.year}
              </Link>
            ) : (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{year.year}</Typography>
            )}
          </TableCell>
          <TableCell><Chip label={`Tier ${year.prestige}`} size="small" variant="outlined" /></TableCell>
          <TableCell align="right">{year.rating ?? '—'}</TableCell>
          <TableCell>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {year.conference !== 'Independent' && <ConfLogo name={year.conference} size={24} />}
              <Typography variant="body2">{year.conference}</Typography>
            </Stack>
          </TableCell>
          <TableCell align="center" sx={{ fontWeight: 600 }}>{year.wins}-{year.losses}</TableCell>
          <TableCell align="center">
            {year.rank === 1 ? (
              <Chip
                icon={<EmojiEventsIcon />}
                label="Champion"
                size="small"
                color="warning"
                variant="outlined"
              />
            ) : (
              <Box component="span" sx={{ color: year.rank > 0 ? 'text.primary' : 'text.secondary' }}>
                {rankLabel(year.rank)}
              </Box>
            )}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </DataTable>
);
