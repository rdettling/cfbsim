import { useState } from 'react';
import { Alert, Box } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadPlayoffPicture } from '../domain/league';
import type { PlayoffPicturePageData } from '../types/pages';
import { PostseasonPictureView } from './playoff/PostseasonPictureView';
import { PostseasonHeader } from './playoff/PostseasonHeader';

const PlayoffPicture = () => {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<PlayoffPicturePageData>({
    fetcher: loadPlayoffPicture,
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
              title="Playoff Picture"
              year={data.info.currentYear}
              week={data.info.currentWeek}
              format={data.playoff.teams}
              autobids={data.playoff.autobids}
              conferenceChampByes={data.playoff.conf_champ_top_4}
              isProjection={data.is_projection}
            />
            <Alert
              severity={data.is_projection ? 'info' : 'success'}
              sx={{ mb: 1.25, py: 0.25, flexShrink: 0 }}
            >
              {data.is_projection
                ? 'At-large spots follow the current poll ranking. The final field is set after conference championship games.'
                : 'This is the saved postseason field selected after conference championship games.'}
            </Alert>
            <PostseasonPictureView
              field={data.playoff_teams}
              bubbleTeams={data.bubble_teams}
              conferenceChampions={data.conference_champions}
              format={data.playoff.teams}
              isProjection={data.is_projection}
              onTeamClick={handleTeamClick}
            />
          </Box>
          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </PageLayout>
  );
};

export default PlayoffPicture;
