import { useState } from 'react';
import { Box, Button } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadResumeComparison } from '../domain/league';
import type { ResumeComparisonPageData } from '../types/pages';
import { PostseasonHeader } from './playoff/PostseasonHeader';
import { ResumeComparisonView } from './playoff/ResumeComparisonView';

const ResumeComparison = () => {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const { data, loading, error } = useDomainData<ResumeComparisonPageData>({
    fetcher: loadResumeComparison,
  });

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };
  const displayedTeams = data
    ? (showAllTeams ? data.resume_teams : data.resume_teams.slice(0, 25))
    : [];

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
              title="Resume Comparison"
              year={data.info.currentYear}
              week={data.info.currentWeek}
              format={data.playoff.teams}
              autobids={data.playoff.autobids}
              conferenceChampByes={data.playoff.conf_champ_top_4}
              isProjection={data.is_projection}
              statusText={data.is_frozen ? 'Frozen after conference championships' : undefined}
              action={data.resume_teams.length > 25 ? (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowAllTeams(current => !current)}
                  aria-pressed={showAllTeams}
                >
                  {showAllTeams ? 'Show Top 25' : `Show All ${data.resume_teams.length}`}
                </Button>
              ) : undefined}
            />
            <ResumeComparisonView
              teams={displayedTeams}
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

export default ResumeComparison;
