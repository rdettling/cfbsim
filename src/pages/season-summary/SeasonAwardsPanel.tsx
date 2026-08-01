import { Box, Chip, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { SeasonSummaryAward, TeamSelectionHandler } from './types';

type SeasonAwardsPanelProps = {
  awards: SeasonSummaryAward[];
  onTeamClick: TeamSelectionHandler;
};

export const SeasonAwardsPanel = ({ awards, onTeamClick }: SeasonAwardsPanelProps) => (
  <Paper
    component="section"
    aria-labelledby="season-awards-title"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography id="season-awards-title" component="h2" variant="h6">
        Award Winners
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        Final individual honors
      </Typography>
    </Box>

    <Stack spacing={0} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {awards.length === 0 ? (
        <Box sx={{ p: 2.5, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            No finalized awards
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Final award results were not returned for this season.
          </Typography>
        </Box>
      ) : (
        awards.map((award) => {
          const winner = award.first_place;
          return (
            <Box
              component="article"
              key={award.category_slug}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 1.5,
                alignItems: 'center',
                px: { xs: 1.5, md: 2 },
                py: 1.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  {award.category_name}
                </Typography>
                {winner ? (
                  <>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: 'center',
                        mt: 0.25,
                      }}
                    >
                      <TeamLogo name={winner.team_name} size={28} />
                      <Box sx={{ minWidth: 0 }}>
                        <MuiLink
                          component={RouterLink}
                          to={`/players/${winner.id}`}
                          underline="hover"
                          sx={{ display: 'block', fontWeight: 700 }}
                        >
                          {winner.first} {winner.last}
                        </MuiLink>
                        <TeamLink name={winner.team_name} onTeamClick={onTeamClick} />
                      </Box>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        mt: 0.5,
                      }}
                    >
                      {award.first_stats?.stat_line ?? 'No final stat line available'}
                    </Typography>
                  </>
                ) : (
                  <Box sx={{ mt: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Winner unavailable
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      This category has no finalized winner.
                    </Typography>
                  </Box>
                )}
              </Box>
              <Chip label={winner?.pos.toUpperCase() ?? '—'} size="small" variant="outlined" />
            </Box>
          );
        })
      )}
    </Stack>
  </Paper>
);
