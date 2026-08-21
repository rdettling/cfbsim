import { Box, Chip, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { SeasonSummaryAward, TeamSelectionHandler } from './types';

type SeasonAwardsPanelProps = {
  awards: SeasonSummaryAward[];
  userTeamName: string;
  onTeamClick: TeamSelectionHandler;
};

export const SeasonAwardsPanel = ({
  awards,
  userTeamName,
  onTeamClick,
}: SeasonAwardsPanelProps) => (
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
      sx={{
        px: { xs: 1.5, md: 1.75 },
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography id="season-awards-title" component="h2" variant="h6">
        Award Winners
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
          const winner = award.placements.find(placement => placement.key === 'first');
          const player = winner?.player ?? null;
          return (
            <Box
              component="article"
              aria-labelledby={`season-award-${award.categorySlug}`}
              key={award.categorySlug}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '150px minmax(0, 1fr)' },
                gap: { xs: 0.5, md: 1.25 },
                alignItems: 'start',
                px: { xs: 1.5, md: 1.75 },
                py: { xs: 1, md: 0.75 },
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  id={`season-award-${award.categorySlug}`}
                  component="h3"
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    display: 'block',
                  }}
                >
                  {award.categoryName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}
                >
                  {award.categoryDescription}
                </Typography>
              </Box>
              {player ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '2.5rem minmax(0, 1fr)',
                    gap: 0.75,
                    alignItems: 'start',
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: '2.5rem',
                      minWidth: '2.5rem',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <TeamLogo name={player.teamName} size={22} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      useFlexGap
                      sx={{ alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}
                    >
                      <MuiLink
                        component={RouterLink}
                        to={`/players/${player.id}`}
                        underline="hover"
                        sx={{ fontWeight: 700, minWidth: 0 }}
                      >
                        {player.first} {player.last}
                      </MuiLink>
                      <Chip
                        label={player.position.toUpperCase()}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                        ·
                      </Typography>
                      <TeamLink name={player.teamName} onTeamClick={onTeamClick} />
                      {player.teamName === userTeamName && (
                        <Chip
                          label="Your Team"
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{
                            height: 20,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        display: 'block',
                        lineHeight: 1.45,
                        mt: 0.25,
                      }}
                    >
                      {winner?.statLine ?? 'No final stat line available'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '2.5rem minmax(0, 1fr)',
                    gap: 0.75,
                  }}
                >
                  <Box aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Winner unavailable
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.45 }}
                    >
                      This category has no finalized winner.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Stack>
  </Paper>
);
