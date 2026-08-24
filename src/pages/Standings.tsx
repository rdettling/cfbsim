import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Paper, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadStandings } from '../domain/league/loaders/standings';
import type { StandingsPageData } from '../types/pages';
import { StandingsDesktopTable } from './standings/StandingsDesktopTable';
import { StandingsMobileList } from './standings/StandingsMobileList';
import { StandingsCommandBar } from './standings/StandingsCommandBar';

const Standings = () => {
  const { conference_name: conferenceName } = useParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data, loading, error } = useDomainData<StandingsPageData>({
    fetcher: () => {
      if (!conferenceName) throw new Error('No conference specified');
      return loadStandings(conferenceName);
    },
    deps: [conferenceName],
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const handleConferenceChange = (name: string) => {
    navigate(`/standings/${encodeURIComponent(name)}`);
  };

  const isIndependent = data?.conference === 'Independent';

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ?? undefined}
    >
      {data && (
        <>
          <StandingsCommandBar
            data={data}
            onConferenceChange={handleConferenceChange}
            onTeamClick={handleTeamClick}
          />

          {data.teams.length > 0 ? (
            <>
              <StandingsDesktopTable
                teams={data.teams}
                isIndependent={isIndependent}
                onTeamClick={handleTeamClick}
              />
              <StandingsMobileList
                teams={data.teams}
                isIndependent={isIndependent}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No standings available</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                There are no teams in the selected conference.
              </Typography>
            </Paper>
          )}

          <TeamInfoModal
            teamName={selectedTeam}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        </>
      )}
    </PageLayout>
  );
};

export default Standings;
