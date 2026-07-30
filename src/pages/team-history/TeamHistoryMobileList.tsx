import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { Fragment } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import { ConfLogo } from '../../components/team/TeamComponents';
import { rankLabel, type TeamHistoryViewProps } from './types';

export const TeamHistoryMobileList = ({ years, teamName, startYear }: TeamHistoryViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={`${teamName} team history`}
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {years.map((year, index) => (
      <Fragment key={year.year}>
      {(index === 0 && year.year >= startYear) ||
      (year.year < startYear && (index === 0 || years[index - 1].year >= startYear)) ? (
        <Box
          key={`${year.year}-era`}
          sx={{ px: 1.5, py: 1, bgcolor: 'background.default' }}
        >
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {year.year >= startYear
              ? 'Dynasty Era'
              : 'Historical Archive — season results only'}
          </Typography>
        </Box>
      ) : null}
      <Box
        key={year.year}
        sx={{
          p: 1.5,
          borderBottom: index === years.length - 1 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {year.has_games ? (
            <Link
              component={RouterLink}
              to={`/${teamName}/schedule/${year.year}`}
              variant="h6"
              underline="hover"
            >
              {year.year}
            </Link>
          ) : (
            <Typography variant="h6">{year.year}</Typography>
          )}
          <Typography variant="h6">
            {year.wins}-{year.losses}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
            mt: 1,
          }}
        >
          <Chip label={`Tier ${year.prestige}`} size="small" variant="outlined" />
          <Chip label={`Rating ${year.rating ?? '—'}`} size="small" variant="outlined" />
          {year.isChampion ? (
            <Chip
              icon={<EmojiEventsIcon />}
              label="Champion"
              size="small"
              color="warning"
              variant="outlined"
            />
          ) : (
            <Chip label={rankLabel(year.rank)} size="small" variant="outlined" />
          )}
        </Stack>
        {year.accomplishments.length > 0 && (
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {year.accomplishments.map(accomplishment => (
              <Chip
                key={`${accomplishment.type}-${accomplishment.label}`}
                label={accomplishment.label}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        )}
        {year.signatureGames.length > 0 && (
          <Stack spacing={0.25} sx={{ mt: 1 }}>
            {year.signatureGames.map(game => (
              <Link
                key={game.id}
                component={RouterLink}
                to={`/game/${game.id}`}
                variant="body2"
                underline="hover"
              >
                {game.label}
              </Link>
            ))}
          </Stack>
        )}
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: 'center',
            mt: 1,
          }}
        >
          {year.conference !== 'Independent' && <ConfLogo name={year.conference} size={24} />}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {year.conference}
          </Typography>
        </Stack>
      </Box>
      </Fragment>
    ))}
  </Paper>
);
