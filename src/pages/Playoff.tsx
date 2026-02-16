import { useState } from 'react';
import { Grid, Alert, Box, Typography } from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadPlayoff } from '../domain/league';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import ChampionshipPlayoff from '../components/playoff/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/playoff/FourTeamPlayoff';
import TwelveTeamPlayoff from '../components/playoff/TwelveTeamPlayoff';
import {
  PlayoffSettings,
  BowlGamesList,
  RankingResumeList,
} from '../components/playoff/PostseasonLists';

const Playoff = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const { data, loading, error } = useDomainData({
    fetcher: loadPlayoff,
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const bowlData = data
    ? data.bowl_games.length
      ? data.bowl_games
      : data.bowl_projections
    : [];

  return (
    <PageLayout
      loading={loading}
      error={error}
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
      containerMaxWidth="xl"
    >
      {data && (
        <>
          <Box
            sx={{
              mb: 3,
              p: { xs: 2, md: 2.5 },
              borderRadius: 3,
              background: 'linear-gradient(120deg, #f6f2e9 0%, #eef3fb 100%)',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                Postseason Hub
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Championship and bowl slate in a single, season‑defining view.
              </Typography>
            </Box>
            <PlayoffSettings
              settings={{
                teams: data.playoff.teams,
                autobids: data.playoff.autobids,
                conf_champ_top_4: data.playoff.conf_champ_top_4,
              }}
            />
          </Box>

          {data.is_projection && (
            <Alert severity="info" sx={{ mb: 3 }}>
              This is a playoff projection based on current rankings. The actual playoff bracket will be determined after Week {data.info.lastWeek - 1}.
            </Alert>
          )}

          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12 }}>
              {data.playoff.teams === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ChampionshipPlayoff
                    playoffTeams={data.playoff_teams}
                    bracket={data.bracket}
                    onTeamClick={handleTeamClick}
                  />
                </Box>
              )}

              {data.playoff.teams === 4 && (
                <FourTeamPlayoff
                  playoffTeams={data.playoff_teams}
                  bracket={data.bracket}
                  onTeamClick={handleTeamClick}
                />
              )}

              {data.playoff.teams === 12 && (
                <TwelveTeamPlayoff bracket={data.bracket} onTeamClick={handleTeamClick} />
              )}
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: 'text.secondary' }}>
              Committee Snapshot
            </Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <RankingResumeList teams={data.resume_teams} onTeamClick={handleTeamClick} />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3 }}>
            <BowlGamesList games={bowlData} onTeamClick={handleTeamClick} />
          </Box>

          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </PageLayout>
  );
};

export default Playoff;
