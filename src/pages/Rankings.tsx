import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadRankings } from '../domain/league/loaders/rankings';
import type { RankingsPageData } from '../types/pages';
import { RankingsDesktopTable } from './rankings/RankingsDesktopTable';
import { RankingsMobileList } from './rankings/RankingsMobileList';

const Rankings = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [showAllTeams, setShowAllTeams] = useState(false);

  const { data, loading, error } = useDomainData<RankingsPageData>({
    fetcher: () => loadRankings(),
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const displayedTeams = data ? (showAllTeams ? data.rankings : data.rankings.slice(0, 25)) : [];

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
          <Stack
            component="header"
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Box>
              <Typography component="h1" variant="h4">
                Rankings
              </Typography>
            </Box>
            {data.rankings.length > 25 && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowAllTeams((current) => !current)}
                aria-pressed={showAllTeams}
              >
                {showAllTeams ? 'Show Top 25' : `Show All ${data.rankings.length}`}
              </Button>
            )}
          </Stack>

          {displayedTeams.length > 0 ? (
            <>
              <RankingsDesktopTable
                teams={displayedTeams}
                onTeamClick={handleTeamClick}
              />
              <RankingsMobileList
                teams={displayedTeams}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No rankings available</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                Rankings will appear when teams are available.
              </Typography>
            </Paper>
          )}

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

export default Rankings;
