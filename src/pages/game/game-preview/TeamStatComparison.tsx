import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../../components/team/TeamComponents';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';

type TeamPreview = GamePageData['preview']['teamA'];
type MetricKey = keyof TeamPreview['stats'];

type TeamStatComparisonProps = {
  awayTeam: Team;
  homeTeam: Team;
  awayPreview: TeamPreview;
  homePreview: TeamPreview;
};

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: 'points_per_game', label: 'Points/Game' },
  { key: 'yards_per_game', label: 'Yards/Game' },
  { key: 'pass_yards_per_game', label: 'Pass Yards/Game' },
  { key: 'pass_tds_per_game', label: 'Pass TD/Game' },
  { key: 'rush_yards_per_game', label: 'Rush Yards/Game' },
  { key: 'turnovers_per_game', label: 'Turnovers/Game' },
];

const formatValue = (value: number, gamesPlayed: number) =>
  gamesPlayed > 0 ? value.toFixed(1) : '—';

const formatRank = (rank: number, gamesPlayed: number) => (gamesPlayed > 0 ? `#${rank}` : '—');

export const TeamStatComparison = ({
  awayTeam,
  homeTeam,
  awayPreview,
  homePreview,
}: TeamStatComparisonProps) => {
  const noPriorGames = awayPreview.gamesPlayed === 0 && homePreview.gamesPlayed === 0;

  return (
    <Paper component="section" variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Typography component="h2" variant="h6">
        Team Stat Comparison
      </Typography>
      {noPriorGames ? (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 1,
          }}
        >
          No prior games are available. Team comparisons will appear after the season begins.
        </Typography>
      ) : (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              alignItems: 'center',
              gap: 1,
              pb: 0.5,
            }}
          >
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <TeamLogo name={awayTeam.name} size={22} />
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {awayTeam.name}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Rank
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: 'center',
                justifyContent: 'flex-end',
                minWidth: 0,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {homeTeam.name}
              </Typography>
              <TeamLogo name={homeTeam.name} size={22} />
            </Stack>
          </Box>
          <Divider />

          {METRICS.map((metric, index) => (
            <Box key={metric.key}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(50px, 1fr) 40px minmax(96px, 1.5fr) 40px minmax(50px, 1fr)',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.4,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatValue(awayPreview.stats[metric.key], awayPreview.gamesPlayed)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {formatRank(awayPreview.ranks[metric.key], awayPreview.gamesPlayed)}
                </Typography>
                <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
                  {metric.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    textAlign: 'right',
                  }}
                >
                  {formatRank(homePreview.ranks[metric.key], homePreview.gamesPlayed)}
                </Typography>
                <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatValue(homePreview.stats[metric.key], homePreview.gamesPlayed)}
                </Typography>
              </Box>
              {index < METRICS.length - 1 && <Divider />}
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
};
