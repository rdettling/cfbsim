import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadRatingsStats } from '../domain/league';
import type { RatingsStatsPageData } from '../types/pages';
import { RatingsStatsDesktop } from './ratings-stats/RatingsStatsDesktop';
import { RatingsStatsMobile } from './ratings-stats/RatingsStatsMobile';

const RatingsStats = () => {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<RatingsStatsPageData>({
    fetcher: loadRatingsStats,
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
          <Box component="header" sx={{ mb: 1.5 }}>
            <Typography component="h1" variant="h4">
              Ratings
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {data.info.currentYear} season · Program and player rating distribution
            </Typography>
          </Box>
          <RatingsStatsDesktop data={data} onTeamClick={handleTeamClick} />
          <RatingsStatsMobile data={data} onTeamClick={handleTeamClick} />
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

export default RatingsStats;
