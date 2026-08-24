import { useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadAwards } from '../domain/league/loaders/awards';
import type { AwardsPageData } from '../types/pages';
import { AwardsBoard } from './awards/AwardsBoard';
import { AwardsHeader } from './awards/AwardsHeader';

const Awards = () => {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error } = useDomainData<AwardsPageData>({
    fetcher: loadAwards,
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
      navbarData={data ?? undefined}
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
            {data.mode ? (
              <>
                <AwardsHeader
                  year={data.info.currentYear}
                  week={data.info.currentWeek}
                  mode={data.mode}
                />
                <AwardsBoard
                  awards={data.awards}
                  mode={data.mode}
                  onTeamClick={handleTeamClick}
                />
              </>
            ) : (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, textAlign: 'center' }}>
                <Typography component="h1" variant="h5">
                  Current awards unavailable
                </Typography>
                <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
                  Award races are available during the season. Finalized winners are archived in
                  League History.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/league/history?tab=awards"
                  variant="contained"
                  sx={{ mt: 2 }}
                >
                  View award history
                </Button>
              </Paper>
            )}
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

export default Awards;
