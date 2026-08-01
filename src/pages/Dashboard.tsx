import { useState } from 'react';
import { Box } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamHeader } from '../components/team/TeamHeader';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { getStageDefinition } from '../constants/stages';
import { useDomainData } from '../domain/hooks';
import { loadDashboard } from '../domain/league';
import type { DashboardPageData } from '../types/pages';
import { DashboardGamesPanel } from './dashboard/DashboardGamesPanel';
import { DashboardHeadlinesPanel } from './dashboard/DashboardHeadlinesPanel';
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
    ? data.team.confName ?? data.team.conference
    : '';
  const stage = data ? getStageDefinition(data.info.stage) : undefined;
  const seasonContext = data
    ? data.info.stage === 'season'
      ? `${data.info.currentYear} season · Week ${data.info.currentWeek}`
      : `${data.info.currentYear} season · ${stage?.label ?? data.info.stage}`
    : '';

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
            title="Dashboard"
            subtitle={seasonContext}
          />
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
            <DashboardHeadlinesPanel headlines={data.top_games} />
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
