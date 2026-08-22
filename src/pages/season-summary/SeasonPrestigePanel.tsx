import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { PRESTIGE_WINDOW_SEASONS } from '../../constants/prestige';
import type { SeasonSummaryTeam, TeamSelectionHandler } from './types';

type SeasonPrestigePanelProps = {
  teams: SeasonSummaryTeam[];
  onTeamClick: TeamSelectionHandler;
};

const formatMetric = (value: number | null) => (value === null ? '—' : value.toFixed(1));

const ShortHistory = ({ team }: { team: SeasonSummaryTeam }) => {
  if (
    team.prestige_seasons_before >= PRESTIGE_WINDOW_SEASONS &&
    team.prestige_seasons_after >= PRESTIGE_WINDOW_SEASONS
  ) return null;
  return (
    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
      {team.prestige_seasons_before} → {team.prestige_seasons_after} seasons
    </Typography>
  );
};

export const getOrderedPrestigeChanges = (teams: SeasonSummaryTeam[]) =>
  teams
    .filter(team => team.prestige_change !== 0)
    .slice()
    .sort((left, right) =>
      right.prestige_change - left.prestige_change || left.name.localeCompare(right.name)
    );

const MovementChip = ({ change }: { change: number }) => (
  <Chip
    label={`${change > 0 ? '+' : ''}${change} ${change > 0 ? 'Promotion' : 'Relegation'}`}
    color={change > 0 ? 'success' : 'error'}
    variant="outlined"
    size="small"
  />
);
const TeamCell = ({
  team,
  onTeamClick,
}: {
  team: SeasonSummaryTeam;
  onTeamClick: TeamSelectionHandler;
}) => (
  <Stack
    direction="row"
    spacing={1}
    sx={{
      alignItems: 'center',
    }}
  >
    <TeamLogo name={team.name} size={24} />
    <TeamLink name={team.name} onTeamClick={onTeamClick} />
  </Stack>
);

export const SeasonPrestigePanel = ({ teams, onTeamClick }: SeasonPrestigePanelProps) => {
  const changes = getOrderedPrestigeChanges(teams);

  return (
    <Paper
      component="section"
      aria-labelledby="season-prestige-title"
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
        sx={{ px: { xs: 1.5, md: 1.75 }, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Typography id="season-prestige-title" component="h2" variant="h6">
          Prestige Movement
        </Typography>
      </Box>

      {changes.length === 0 ? (
        <Box sx={{ p: 2.5, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            No prestige changes
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            No teams qualified for promotion or relegation this season.
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: { xs: 'none', lg: 'block' },
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            <Table size="small" stickyHeader aria-label="Prestige movement">
              <TableHead>
                <TableRow>
                  <TableCell>Team</TableCell>
                  <TableCell align="right">
                    {PRESTIGE_WINDOW_SEASONS}-Year Score
                  </TableCell>
                  <TableCell align="right">Avg Finish</TableCell>
                  <TableCell align="right">Tier</TableCell>
                  <TableCell align="right">Movement</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {changes.map((team) => {
                  const change = team.prestige_change;
                  return (
                    <TableRow key={team.name}>
                      <TableCell>
                        <TeamCell team={team} onTeamClick={onTeamClick} />
                      </TableCell>
                      <TableCell align="right">
                        {formatMetric(team.prestige_score_before)} →{' '}
                        {formatMetric(team.prestige_score_after)}
                        <ShortHistory team={team} />
                      </TableCell>
                      <TableCell align="right">
                        {formatMetric(team.avg_rank_before)} →{' '}
                        {formatMetric(team.avg_rank_after)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {team.prestige} → {team.next_prestige}
                      </TableCell>
                      <TableCell align="right">
                        <MovementChip change={change} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>

          <Stack
            sx={{
              display: { xs: 'flex', lg: 'none' },
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            {changes.map((team) => {
              const change = team.prestige_change;
              return (
                <Box
                  component="article"
                  key={team.name}
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <TeamCell team={team} onTeamClick={onTeamClick} />
                    <MovementChip change={change} />
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 1,
                      mt: 1.25,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        {PRESTIGE_WINDOW_SEASONS}-Year Score
                      </Typography>
                      <Typography variant="body2">
                        {formatMetric(team.prestige_score_before)} →{' '}
                        {formatMetric(team.prestige_score_after)}
                      </Typography>
                      <ShortHistory team={team} />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        Avg Finish
                      </Typography>
                      <Typography variant="body2">
                        {formatMetric(team.avg_rank_before)} →{' '}
                        {formatMetric(team.avg_rank_after)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        Current
                      </Typography>
                      <Typography variant="body2">
                        Tier {team.prestige}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        Next
                      </Typography>
                      <Typography variant="body2">
                        Tier {team.next_prestige}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </>
      )}
    </Paper>
  );
};
