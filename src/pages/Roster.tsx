import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import TeamHeader from '../components/team/TeamHeader';
import { useDomainData } from '../domain/hooks';
import { loadTeamRoster } from '../domain/league';
import type { TeamRosterPageData } from '../types/pages';
import { RosterDesktopTable } from './roster/RosterDesktopTable';
import { RosterMobileList } from './roster/RosterMobileList';

const Roster = () => {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const [positionFilter, setPositionFilter] = useState('');
  const { data, loading, error } = useDomainData<TeamRosterPageData>({
    fetcher: () => loadTeamRoster(teamName),
    deps: [teamName],
  });

  useEffect(() => {
    document.title = teamName ? `${teamName} Roster` : 'Roster';
    return () => {
      document.title = 'College Football';
    };
  }, [teamName]);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.positions
      .filter(position => !positionFilter || position === positionFilter)
      .map(position => ({
        position,
        players: data.roster
          .filter(player => player.pos === position)
          .slice()
          .sort((a, b) =>
            b.rating !== a.rating
              ? b.rating - a.rating
              : `${a.last},${a.first}`.localeCompare(`${b.last},${b.first}`)
          ),
      }))
      .filter(group => group.players.length > 0);
  }, [data, positionFilter]);

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ? {
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences,
      } : undefined}
    >
      {data && (
        <>
          <TeamHeader
            team={data.team}
            teams={data.teams}
            onTeamChange={name => navigate(`/${name}/roster`)}
          />
          <Stack
            component="header"
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography component="h2" variant="h5">Roster</Typography>
              <Typography variant="body2" color="text.secondary">
                {data.roster.length} active players
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: { xs: 150, sm: 190 } }}>
              <InputLabel id="roster-position-label">Position</InputLabel>
              <Select
                labelId="roster-position-label"
                value={positionFilter}
                label="Position"
                onChange={event => setPositionFilter(event.target.value)}
              >
                <MenuItem value="">All Positions</MenuItem>
                {data.positions.map(position => (
                  <MenuItem key={position} value={position}>{position.toUpperCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {groups.length > 0 ? (
            <>
              <RosterDesktopTable groups={groups} />
              <RosterMobileList groups={groups} />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">
                {positionFilter ? `No ${positionFilter.toUpperCase()} players` : 'No active roster'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {positionFilter
                  ? 'No active players match the selected position.'
                  : 'Active players will appear when the roster is available.'}
              </Typography>
            </Paper>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default Roster;
