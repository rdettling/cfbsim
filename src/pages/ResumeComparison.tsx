import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadResumeComparison } from '../domain/league/loaders/postseason/loadResumeComparison';
import type { ResumeComparisonPageData } from '../types/pages';
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
    ? (showAllTeams ? data.teams : data.teams.slice(0, 25))
    : [];

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
              Resume Comparison
            </Typography>
            <ResumeComparisonView
              teams={displayedTeams}
              totalTeamCount={data.teams.length}
              showAllTeams={showAllTeams}
              format={data.format}
              isProjection={data.isProjection}
              onTeamClick={handleTeamClick}
              onToggleShowAll={() => setShowAllTeams(current => !current)}
            />
          </Box>
          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </PageLayout>
  );
};

export default ResumeComparison;
