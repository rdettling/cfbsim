import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadBowlGames } from '../domain/league/loaders/postseason/loadBowlGames';
import type { BowlGamesPageData } from '../types/pages';
import { PostseasonBowlView } from './playoff/PostseasonBowlView';

const BowlGames = () => {
  const navigate = useNavigate();
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<BowlGamesPageData>({ fetcher: loadBowlGames });

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

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
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: { lg: 1 }, minHeight: { lg: 0 } }}>
            <Typography component="h1" variant="h4" sx={{ mb: 1.25, flexShrink: 0 }}>
              Bowl Games
            </Typography>
            <PostseasonBowlView
              games={data.games}
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
