import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import TeamHeader from '../components/team/TeamHeader';
import { useDomainData } from '../domain/hooks';
import { loadTeamHistory } from '../domain/league';
import type { TeamHistoryPageData } from '../types/pages';
import { TeamHistoryDesktopTable } from './team-history/TeamHistoryDesktopTable';
import { TeamHistoryMobileList } from './team-history/TeamHistoryMobileList';
import { DynastyOverview } from './team-history/DynastyOverview';

const TeamHistory = () => {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useDomainData<TeamHistoryPageData>({
    fetcher: () => loadTeamHistory(teamName),
    deps: [teamName],
  });

  useEffect(() => {
    document.title = teamName ? `${teamName} History` : 'Team History';
    return () => {
      document.title = 'College Football';
    };
  }, [teamName]);

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
            teams={data.teams}
            onTeamChange={(name) => navigate(`/${name}/history`)}
          />
          <Stack
            component="header"
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Box>
              <Typography component="h2" variant="h5">
                History
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Season-by-season program results
              </Typography>
            </Box>
          </Stack>
          <DynastyOverview overview={data.dynastyOverview} />
          {data.years.length > 0 ? (
            <>
              <TeamHistoryDesktopTable
                years={data.years}
                teamName={data.team.name}
                startYear={data.startYear}
              />
              <TeamHistoryMobileList
                years={data.years}
                teamName={data.team.name}
                startYear={data.startYear}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No team history available</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                Completed seasons will appear here when history is available.
              </Typography>
            </Paper>
          )}
        </>
      )}
    </PageLayout>
  );
};

export default TeamHistory;
