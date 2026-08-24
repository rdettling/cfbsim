import { useState } from 'react';
import { Box } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamHeader } from '../components/team/TeamHeader';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadDashboard } from '../domain/league/loaders/season/loadDashboard';
import type { DashboardPageData } from '../types/pages';
import { DashboardGamesPanel } from './dashboard/DashboardGamesPanel';
import { DashboardNewsPanel } from './dashboard/DashboardNewsPanel';
import {
  DashboardRankingsPanel,
  DashboardStandingsPanel,
} from './dashboard/DashboardTeamPanels';

const Dashboard = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data, loading, error } = useDomainData<DashboardPageData>({
    fetcher: loadDashboard,
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const conferenceName = data
    ? data.team.confName
    : '';
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
          <TeamHeader team={data.team} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gridTemplateRows: { lg: 'minmax(0, 1fr)' },
              gap: 1.5,
              flex: { lg: 1 },
              minHeight: { lg: 0 },
            }}
          >
            <DashboardGamesPanel
              previousGame={data.prev_game}
              currentGame={data.curr_game}
              onTeamClick={handleTeamClick}
            />
            <DashboardNewsPanel stories={data.topStories} />
            <DashboardStandingsPanel
              conferenceName={conferenceName}
              teams={data.confTeams}
              currentTeamName={data.team.name}
              teamColor={data.team.colorPrimary}
              onTeamClick={handleTeamClick}
            />
            <DashboardRankingsPanel
              teams={data.top_10}
              currentTeamName={data.team.name}
              teamColor={data.team.colorPrimary}
              onTeamClick={handleTeamClick}
            />
          </Box>

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

export default Dashboard;
