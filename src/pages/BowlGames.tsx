import { useState } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadBowlGames } from '../domain/league/loaders/postseason/loadBowlGames';
import type { BowlGamesPageData } from '../types/pages';
import { PostseasonBowlView } from './playoff/PostseasonBowlView';
import { PostseasonHeader } from './playoff/PostseasonHeader';

const BowlGames = () => {
  const navigate = useNavigate();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<BowlGamesPageData>({ fetcher: loadBowlGames });

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  const games = data?.bowl_games.length ? data.bowl_games : data?.bowl_projections ?? [];

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
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: { lg: 1 }, minHeight: { lg: 0 } }}>
            <PostseasonHeader
              title="Bowl Games"
              year={data.info.currentYear}
              week={data.info.currentWeek}
              format={data.playoff.teams}
              autobids={data.playoff.autobids}
              conferenceChampByes={data.playoff.conf_champ_top_4}
              isProjection={data.is_projection}
            />
            <PostseasonBowlView
              games={games}
              showingProjections={data.bowl_games.length === 0}
              onGameClick={gameId => navigate(`/game/${gameId}`)}
              onTeamClick={handleTeamClick}
            />
          </Box>
          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </PageLayout>
  );
};

export default BowlGames;
