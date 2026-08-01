import StarIcon from '@mui/icons-material/Star';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { RatingsStatsPageData } from '../../types/pages';
import type { StarRating } from '../../types/stats';

type RatingsStatsDesktopProps = {
  data: RatingsStatsPageData;
  onTeamClick: (teamName: string) => void;
};

const stars: StarRating[] = [5, 4, 3, 2, 1];

const PanelHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <Box sx={{ px: 1.75, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
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

export const RatingsStatsDesktop = ({ data, onTeamClick }: RatingsStatsDesktopProps) => (
  <Box
    sx={{
      display: { xs: 'none', md: 'grid' },
      gridTemplateColumns: 'minmax(0, 2fr) minmax(330px, 1fr)',
      gap: 1.5,
      flex: { lg: 1 },
      minHeight: { lg: 0 },
    }}
  >
    <Stack spacing={1.5} sx={{ minHeight: 0, overflowY: { lg: 'auto' }, pr: { lg: 0.5 } }}>
      <Paper component="section" variant="outlined">
        <PanelHeader
          title="Star Distribution by Prestige"
          subtitle="Player star mix within each program prestige tier"
        />
        {data.prestige_stars_table.length > 0 ? (
          <TableContainer>
            <Table size="small" aria-label="Star distribution by prestige">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell>Tier</TableCell>
                  <TableCell align="right">Teams</TableCell>
                  <TableCell align="right">Avg Rating</TableCell>
                  <TableCell align="right">Avg Stars</TableCell>
                  {stars.map((star) => (
                    <TableCell key={star} align="right">
                      {star}★
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.prestige_stars_table
                  .slice()
                  .reverse()
                  .map((row) => (
                    <TableRow key={row.prestige} hover>
                      <TableCell>
                        <Chip label={`Tier ${row.prestige}`} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{row.team_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {row.avg_rating.toFixed(1)}
                      </TableCell>
                      <TableCell align="right">{row.average_stars.toFixed(2)}</TableCell>
                      {stars.map((star) => (
                        <TableCell key={star} align="right">
                          {row.star_percentages[star].toFixed(1)}%
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography
            sx={{
              color: 'text.secondary',
              p: 2,
            }}
          >
            No prestige data available.
          </Typography>
        )}
      </Paper>

      <Paper component="section" variant="outlined">
        <PanelHeader
          title="Players by Star Rating"
          subtitle="Current and class-year average ratings"
        />
        <TableContainer>
          <Table size="small" aria-label="Players by star rating">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell>Stars</TableCell>
                <TableCell align="right">Players</TableCell>
                <TableCell align="right">Current</TableCell>
                <TableCell align="right">Fr</TableCell>
                <TableCell align="right">So</TableCell>
                <TableCell align="right">Jr</TableCell>
                <TableCell align="right">Sr</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stars.map((star) => (
                <TableRow key={star} hover>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{
                        alignItems: 'center',
                      }}
                    >
                      <StarIcon color="warning" fontSize="small" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {star} stars
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {data.total_star_counts.counts[star].toLocaleString()}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {data.total_star_counts.avg_ratings[star]}
                  </TableCell>
                  <TableCell align="right">{data.total_star_counts.avg_ratings_fr[star]}</TableCell>
                  <TableCell align="right">{data.total_star_counts.avg_ratings_so[star]}</TableCell>
                  <TableCell align="right">{data.total_star_counts.avg_ratings_jr[star]}</TableCell>
                  <TableCell align="right">{data.total_star_counts.avg_ratings_sr[star]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>

    <Paper
      component="section"
      variant="outlined"
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
    >
      <PanelHeader title="Team Ratings" subtitle="All programs ranked by current rating" />
      {data.teams.length > 0 ? (
        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table stickyHeader size="small" aria-label="Team ratings">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell align="center" sx={{ width: 58 }}>
                  Rank
                </TableCell>
                <TableCell>Team</TableCell>
                <TableCell align="right">Rating</TableCell>
                <TableCell align="center">Tier</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.teams.map((team, index) => (
                <TableRow key={team.name} hover>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{
                        alignItems: 'center',
                      }}
                    >
                      <TeamLogo name={team.name} size={26} />
                      <TeamLink name={team.name} onTeamClick={onTeamClick} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {team.rating}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={team.prestige} size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography
          sx={{
            color: 'text.secondary',
            p: 2,
          }}
        >
          No team ratings available.
        </Typography>
      )}
    </Paper>
  </Box>
);
