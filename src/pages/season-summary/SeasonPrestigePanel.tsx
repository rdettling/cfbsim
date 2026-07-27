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
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import type { SeasonSummaryTeam, TeamSelectionHandler } from './types';

type SeasonPrestigePanelProps = {
  teams: SeasonSummaryTeam[];
  onTeamClick: TeamSelectionHandler;
};

const formatAverage = (value: number | null) =>
  value === null ? '—' : value.toFixed(1);

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
  <Stack direction="row" spacing={1} alignItems="center">
    <TeamLogo name={team.name} size={24} />
    <TeamLink name={team.name} onTeamClick={onTeamClick} />
  </Stack>
);

export const SeasonPrestigePanel = ({
  teams,
  onTeamClick,
}: SeasonPrestigePanelProps) => (
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
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography id="season-prestige-title" component="h2" variant="h6">
        Prestige Movement
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Preview for next season · 4-year average rank
      </Typography>
    </Box>

    {teams.length === 0 ? (
      <Box sx={{ p: 2.5, textAlign: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          No prestige changes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No teams qualified for promotion or relegation this season.
        </Typography>
      </Box>
    ) : (
      <>
        <Box sx={{ display: { xs: 'none', lg: 'block' }, flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader aria-label="Prestige movement">
            <TableHead>
              <TableRow>
                <TableCell>Team</TableCell>
                <TableCell align="right">4-Year Avg</TableCell>
                <TableCell align="right">Current Tier</TableCell>
                <TableCell align="right">Next Tier</TableCell>
                <TableCell align="right">Movement</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => {
                const change = team.prestige_change ?? 0;
                return (
                  <TableRow key={team.name}>
                    <TableCell><TeamCell team={team} onTeamClick={onTeamClick} /></TableCell>
                    <TableCell align="right">
                      {formatAverage(team.avg_rank_before)} → {formatAverage(team.avg_rank_after)}
                    </TableCell>
                    <TableCell align="right">Tier {team.prestige}</TableCell>
                    <TableCell align="right">Tier {team.prestige + change}</TableCell>
                    <TableCell align="right"><MovementChip change={change} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Stack sx={{ display: { xs: 'flex', lg: 'none' }, flex: 1, minHeight: 0, overflow: 'auto' }}>
          {teams.map((team) => {
            const change = team.prestige_change ?? 0;
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
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <TeamCell team={team} onTeamClick={onTeamClick} />
                  <MovementChip change={change} />
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 1,
                    mt: 1.25,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">4-Year Avg</Typography>
                    <Typography variant="body2">
                      {formatAverage(team.avg_rank_before)} → {formatAverage(team.avg_rank_after)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Current</Typography>
                    <Typography variant="body2">Tier {team.prestige}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Next</Typography>
                    <Typography variant="body2">Tier {team.prestige + change}</Typography>
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
