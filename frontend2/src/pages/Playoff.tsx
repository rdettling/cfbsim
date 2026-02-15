import { useState } from 'react';
import { Grid, Alert, Tabs, Tab, Box, Typography } from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { loadPlayoff } from '../domain/league';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import ChampionshipPlayoff from '../components/playoff/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/playoff/FourTeamPlayoff';
import TwelveTeamPlayoff from '../components/playoff/TwelveTeamPlayoff';
import {
  PlayoffSettings,
  PlayoffTeamsList,
  BubbleTeamsList,
  ConferenceChampionsList,
  BowlGamesList,
} from '../components/playoff/PostseasonLists';

const Playoff = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);

  const { data, loading, error } = useDomainData({
    fetcher: loadPlayoff,
  });

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

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

          {data.playoff.teams !== 2 && (
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              sx={{ mb: 3 }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Championship" />
              <Tab label="Selection" />
              <Tab label="Bowls" />
            </Tabs>
          )}

          {(data.playoff.teams === 2 || activeTab === 0) && (
            <Grid container spacing={3} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, lg: data.playoff.teams === 2 ? 5 : 12 }}>
                {data.playoff.teams === 2 && (
                  <ChampionshipPlayoff
                    playoffTeams={data.playoff_teams}
                    bracket={data.bracket}
                    onTeamClick={handleTeamClick}
                  />
                )}

                {data.playoff.teams === 4 && (
                  <FourTeamPlayoff playoffTeams={data.playoff_teams} bracket={data.bracket} onTeamClick={handleTeamClick} />
                )}

                {data.playoff.teams === 12 && (
                  <TwelveTeamPlayoff bracket={data.bracket} onTeamClick={handleTeamClick} />
                )}
              </Grid>

              {data.playoff.teams === 2 && (
                <Grid size={{ xs: 12, lg: 7 }}>
                  <BowlGamesList
                    games={data.bowl_games.length ? data.bowl_games : data.bowl_projections}
                    onTeamClick={handleTeamClick}
                  />
                </Grid>
              )}
            </Grid>
          )}

          {data.playoff.teams !== 2 && activeTab === 1 && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {data.playoff.teams === 12 && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <PlayoffTeamsList teams={data.playoff_teams} onTeamClick={handleTeamClick} />
                </Grid>
              )}
              <Grid size={{ xs: 12, md: data.playoff.teams === 12 ? 4 : 6 }}>
                <BubbleTeamsList teams={data.bubble_teams} onTeamClick={handleTeamClick} />
              </Grid>
              <Grid size={{ xs: 12, md: data.playoff.teams === 12 ? 4 : 6 }}>
                <ConferenceChampionsList champions={data.conference_champions} onTeamClick={handleTeamClick} />
              </Grid>
            </Grid>
          )}

          {(data.playoff.teams === 2 || activeTab === 2) && data.playoff.teams !== 2 && (
            <Box sx={{ mt: 1 }}>
              <BowlGamesList
                games={data.bowl_games.length ? data.bowl_games : data.bowl_projections}
                onTeamClick={handleTeamClick}
              />
            </Box>
          )}

          <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      )}
    </PageLayout>
  );
};

export default Playoff;
