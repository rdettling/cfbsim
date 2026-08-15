import { useState } from 'react';
import { Alert, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadPlayoffBracket } from '../domain/league/loaders/postseason/loadPlayoffBracket';
import type { PlayoffBracketPageData } from '../types/pages';
import { PostseasonBracketView } from './playoff/PostseasonBracketView';
import { PostseasonHeader } from './playoff/PostseasonHeader';
import type { PostseasonFormat } from './playoff/types';

const Playoff = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const { data, loading, error } = useDomainData<PlayoffBracketPageData>({
    fetcher: loadPlayoffBracket,
  });

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
              title="Playoff Bracket"
              year={data.info.currentYear}
              week={data.info.currentWeek}
              format={data.playoff.teams}
              autobids={data.playoff.autobids}
              conferenceChampByes={data.playoff.conf_champ_top_4}
              isProjection={data.is_projection}
            />
            {data.is_projection && (
              <Alert severity="info" sx={{ mb: 1.25, py: 0, flexShrink: 0 }}>
                This bracket is based on current rankings. The final field is set after Week{' '}
                {data.info.lastWeek - 1}.
              </Alert>
            )}
            <PostseasonBracketView
              bracket={data.bracket}
              format={data.playoff.teams as PostseasonFormat}
              hasTeams={data.playoff_teams.length > 0}
              onGameClick={gameId => navigate(`/game/${gameId}`)}
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

export default Playoff;
