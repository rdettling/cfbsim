import { useState } from 'react';
import { Alert, Box, Tab, Tabs } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadPlayoff } from '../domain/league';
import type { PlayoffPageData } from '../types/pages';
import { PostseasonBowlView } from './playoff/PostseasonBowlView';
import { PostseasonBracketView } from './playoff/PostseasonBracketView';
import { PostseasonCommitteeView } from './playoff/PostseasonCommitteeView';
import { PostseasonHeader } from './playoff/PostseasonHeader';
import type { PostseasonFormat, PostseasonView } from './playoff/types';

const POSTSEASON_TABS: Array<{ value: PostseasonView; label: string }> = [
  { value: 'bracket', label: 'Bracket' },
  { value: 'committee', label: 'Committee' },
  { value: 'bowls', label: 'Bowls' },
];

const Playoff = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<PostseasonView>('bracket');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');

  const { data, loading, error } = useDomainData<PlayoffPageData>({
    fetcher: loadPlayoff,
  });

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  const handleGameClick = (gameId: number) => {
    navigate(`/game/${gameId}`);
  };

  const bowlGames = data
    ? data.bowl_games.length > 0
      ? data.bowl_games
      : data.bowl_projections
    : [];

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
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: { lg: 1 },
              minHeight: { lg: 0 },
            }}
          >
            <PostseasonHeader
              year={data.info.currentYear}
              week={data.info.currentWeek}
              format={data.playoff.teams}
              autobids={data.playoff.autobids}
              conferenceChampByes={data.playoff.conf_champ_top_4}
              isProjection={data.is_projection}
            />

            {data.is_projection && (
              <Alert severity="info" sx={{ mb: 1.25, py: 0, flexShrink: 0 }}>
                This field is based on current rankings. The final bracket is set after
                Week {data.info.lastWeek - 1}.
              </Alert>
            )}

            <Tabs
              value={activeView}
              onChange={(_, value: PostseasonView) => setActiveView(value)}
              selectionFollowsFocus
              aria-label="Postseason hub sections"
              sx={{
                minHeight: 42,
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                mb: 1.25,
              }}
            >
              {POSTSEASON_TABS.map((tab) => (
                <Tab
                  key={tab.value}
                  id={`postseason-tab-${tab.value}`}
                  aria-controls={`postseason-panel-${tab.value}`}
                  value={tab.value}
                  label={tab.label}
                  sx={{ minHeight: 42 }}
                />
              ))}
            </Tabs>

            <Box
              role="tabpanel"
              id={`postseason-panel-${activeView}`}
              aria-labelledby={`postseason-tab-${activeView}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: { lg: 1 },
                minHeight: { lg: 0 },
              }}
            >
              {activeView === 'bracket' && (
                <PostseasonBracketView
                  bracket={data.bracket}
                  format={data.playoff.teams as PostseasonFormat}
                  hasTeams={data.playoff_teams.length > 0}
                  onGameClick={handleGameClick}
                  onTeamClick={handleTeamClick}
                />
              )}
              {activeView === 'committee' && (
                <PostseasonCommitteeView
                  field={data.playoff_teams}
                  bubbleTeams={data.bubble_teams}
                  conferenceChampions={data.conference_champions}
                  resumeTeams={data.resume_teams}
                  format={data.playoff.teams}
                  isProjection={data.is_projection}
                  onTeamClick={handleTeamClick}
                />
              )}
              {activeView === 'bowls' && (
                <PostseasonBowlView
                  games={bowlGames}
                  showingProjections={data.bowl_games.length === 0}
                  onGameClick={handleGameClick}
                  onTeamClick={handleTeamClick}
                />
              )}
            </Box>
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
