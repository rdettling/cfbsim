import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamHeader } from '../components/team/TeamHeader';
import { useDomainData } from '../domain/hooks';
import { loadTeamRoster } from '../domain/league/loaders/team/loadTeamRoster';
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
      .filter((position) => !positionFilter || position === positionFilter)
      .map((position) => ({
        position,
        players: data.roster
          .filter((player) => player.pos === position)
          .slice()
          .sort((a, b) =>
            b.rating !== a.rating
              ? b.rating - a.rating
              : `${a.last},${a.first}`.localeCompare(`${b.last},${b.first}`),
          ),
      }))
      .filter((group) => group.players.length > 0);
  }, [data, positionFilter]);

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={
        data
          ? {
              team: data.team,
              currentStage: data.info.stage,
              info: data.info,
              conferences: data.conferences,
            }
          : undefined
      }
    >
      {data && (
        <>
          <TeamHeader
            team={data.team}
            teamSelector={{
              teams: data.teams,
              onChange: (name) => navigate(`/${name}/roster`),
            }}
            controls={
              <FormControl size="small" sx={{ minWidth: { sm: 190 } }}>
                <InputLabel id="roster-position-label">Position</InputLabel>
                <Select
                  labelId="roster-position-label"
                  value={positionFilter}
                  label="Position"
                  onChange={(event) => setPositionFilter(event.target.value)}
                >
                  <MenuItem value="">All Positions</MenuItem>
                  {data.positions.map((position) => (
                    <MenuItem key={position} value={position}>
                      {position.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            }
          />

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
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                {positionFilter
                  ? 'No players match the selected position.'
                  : 'Players will appear when the roster is available.'}
              </Typography>
            </Paper>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default Roster;
