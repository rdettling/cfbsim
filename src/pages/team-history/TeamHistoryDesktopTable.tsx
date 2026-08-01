import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { Fragment } from 'react';
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
import { ConferenceLogo } from '../../components/team/TeamLogo';
import { DataTable } from '../../components/ui/DataTable';
import { getHistoryEraLabel } from './historyEra';
import { rankLabel, type TeamHistoryViewProps } from './types';

export const TeamHistoryDesktopTable = ({ years, teamName, startYear }: TeamHistoryViewProps) => (
  <DataTable ariaLabel={`${teamName} team history`} minWidth={1120}>
    <TableHead>
      <TableRow sx={{ bgcolor: 'background.default' }}>
        <TableCell sx={{ width: 110 }}>Year</TableCell>
        <TableCell sx={{ width: 130 }}>Prestige</TableCell>
        <TableCell align="right" sx={{ width: 100 }}>
          Rating
        </TableCell>
        <TableCell>Conference</TableCell>
        <TableCell align="center" sx={{ width: 120 }}>
          Record
        </TableCell>
        <TableCell align="center" sx={{ width: 150 }}>
          Final Rank
        </TableCell>
        <TableCell sx={{ minWidth: 210 }}>Accomplishments</TableCell>
        <TableCell sx={{ minWidth: 250 }}>Signature Games</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {years.map((year, index) => {
        const eraLabel = getHistoryEraLabel(
          year.year,
          years[index - 1]?.year,
          startYear,
        );
        return (
          <Fragment key={year.year}>
            {eraLabel && (
              <TableRow>
                <TableCell colSpan={8} sx={{ bgcolor: 'background.default', py: 1 }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    {eraLabel}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            <TableRow hover>
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
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {year.year}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip label={`Tier ${year.prestige}`} size="small" variant="outlined" />
              </TableCell>
              <TableCell align="right">{year.rating ?? '—'}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  {year.conference !== 'Independent' && (
                    <ConferenceLogo name={year.conference} size={24} />
                  )}
                  <Typography variant="body2">{year.conference}</Typography>
                </Stack>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                {year.wins}-{year.losses}
              </TableCell>
              <TableCell align="center">
                {year.isChampion ? (
                  <Chip
                    icon={<EmojiEventsIcon />}
                    label="Champion"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                ) : (
                  <Box
                    component="span"
                    sx={{ color: year.rank > 0 ? 'text.primary' : 'text.secondary' }}
                  >
                    {rankLabel(year.rank)}
                  </Box>
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {year.accomplishments.length
                    ? year.accomplishments.map(accomplishment => (
                        <Chip
                          key={`${accomplishment.type}-${accomplishment.label}`}
                          label={accomplishment.label}
                          size="small"
                          variant="outlined"
                        />
                      ))
                    : '—'}
                </Stack>
              </TableCell>
              <TableCell>
                <Stack spacing={0.25}>
                  {year.signatureGames.length
                    ? year.signatureGames.map(game => (
                        <Link
                          key={game.id}
                          component={RouterLink}
                          to={`/game/${game.id}`}
                          variant="body2"
                          underline="hover"
                        >
                          {game.label}
                        </Link>
                      ))
                    : '—'}
                </Stack>
              </TableCell>
            </TableRow>
          </Fragment>
        );
      })}
    </TableBody>
  </DataTable>
);
