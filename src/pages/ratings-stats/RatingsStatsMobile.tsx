import StarIcon from '@mui/icons-material/Star';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { RatingsStatsPageData } from '../../types/pages';
import type { StarRating } from '../../types/stats';

type RatingsStatsMobileProps = {
  data: RatingsStatsPageData;
  onTeamClick: (teamName: string) => void;
};

const stars: StarRating[] = [5, 4, 3, 2, 1];

const SectionHeading = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <Box sx={{ mb: 1 }}>
    <Typography variant="h6">{title}</Typography>
    <Typography
      variant="body2"
      sx={{
        color: 'text.secondary',
      }}
    >
      {subtitle}
    </Typography>
  </Box>
);

export const RatingsStatsMobile = ({ data, onTeamClick }: RatingsStatsMobileProps) => (
  <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
    <Box component="section">
      <SectionHeading
        title="Star Distribution by Prestige"
        subtitle="Player star mix by program tier"
      />
      {data.prestige_stars_table.length > 0 ? (
        <Stack spacing={1}>
          {data.prestige_stars_table
            .slice()
            .reverse()
            .map((row) => (
              <Paper key={row.prestige} variant="outlined" sx={{ p: 1.25 }}>
                <Stack
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Chip label={`Tier ${row.prestige}`} size="small" variant="outlined" />
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {row.team_count} teams
                  </Typography>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mt: 1 }}>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Avg rating
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.avg_rating.toFixed(1)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Avg stars
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.average_stars.toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5, mt: 1 }}
                >
                  {stars.map((star) => (
                    <Box
                      key={star}
                      sx={{ p: 0.5, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center' }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {star}★
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                        }}
                      >
                        {row.star_percentages[star].toFixed(1)}%
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            ))}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            No prestige data available.
          </Typography>
        </Paper>
      )}
    </Box>

    <Box component="section">
      <SectionHeading title="Players by Star Rating" subtitle="Current and class-year averages" />
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {stars.map((star, index) => (
          <Box
            key={star}
            sx={{
              p: 1.25,
              borderBottom: index === stars.length - 1 ? 0 : '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: 'center',
                }}
              >
                <StarIcon color="warning" fontSize="small" />
                <Typography sx={{ fontWeight: 600 }}>{star} stars</Typography>
              </Stack>
              <Typography variant="body2">
                {data.total_star_counts.counts[star].toLocaleString()} players
              </Typography>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5, mt: 1 }}>
              {[
                ['Now', data.total_star_counts.avg_ratings[star]],
                ['Fr', data.total_star_counts.avg_ratings_fr[star]],
                ['So', data.total_star_counts.avg_ratings_so[star]],
                ['Jr', data.total_star_counts.avg_ratings_jr[star]],
                ['Sr', data.total_star_counts.avg_ratings_sr[star]],
              ].map(([label, value]) => (
                <Box key={label} sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      display: 'block',
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Paper>
    </Box>

    <Box component="section">
      <SectionHeading title="Team Ratings" subtitle="All programs ranked by current rating" />
      {data.teams.length > 0 ? (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          {data.teams.map((team, index) => (
            <Stack
              key={team.name}
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                p: 1.25,
                borderBottom: index === data.teams.length - 1 ? 0 : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography sx={{ width: 28, textAlign: 'center', fontWeight: 600 }}>
                {index + 1}
              </Typography>
              <TeamLogo name={team.name} size={32} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <TeamLink name={team.name} onTeamClick={onTeamClick} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  Tier {team.prestige}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 700 }}>{team.rating}</Typography>
            </Stack>
          ))}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            No team ratings available.
          </Typography>
        </Paper>
      )}
    </Box>
  </Stack>
);
