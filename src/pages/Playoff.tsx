import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { Navigate, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadPlayoffBracket } from '../domain/league/loaders/postseason/loadPlayoffBracket';
import type { PlayoffBracketPageData } from '../types/pages';
import { PostseasonBracketView } from './playoff/PostseasonBracketView';
import { ROUTES } from '../constants/routes';

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

  if (data && data.format !== 12) {
    return <Navigate to={ROUTES.BOWL_GAMES} replace />;
  }

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
            <Stack
              component="header"
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                mb: 1.25,
                flexShrink: 0,
              }}
            >
              <Typography component="h1" variant="h4">Playoff Bracket</Typography>
              <Stack
                direction="row"
                spacing={0.75}
                useFlexGap
                aria-label="Playoff settings"
                sx={{ flexWrap: 'wrap' }}
              >
                <Chip label={`${data.format}-team playoff`} size="small" variant="outlined" />
                <Chip label={`${data.autobids} autobids`} size="small" variant="outlined" />
                <Chip
                  label={
                    data.conferenceChampionsReceiveTopSeeds
                      ? 'Top 4 champions receive byes'
                      : 'Top 4 teams receive byes'
                  }
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>
            <PostseasonBracketView
              bracket={data.bracket}
              format={data.format}
              hasTeams={data.hasTeams}
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
