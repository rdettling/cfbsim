import { useState } from 'react';
import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadSeasonSummary } from '../domain/league/loaders/seasonSummary';
import type { SeasonSummaryPageData } from '../types/pages';
import { SeasonAwardsPanel } from './season-summary/SeasonAwardsPanel';
import { SeasonOverview } from './season-summary/SeasonOverview';
import { SeasonPrestigePanel } from './season-summary/SeasonPrestigePanel';
import type { SeasonSummaryDetail } from './season-summary/types';

const SeasonSummary = () => {
  const [activeDetail, setActiveDetail] = useState<SeasonSummaryDetail>('awards');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error } = useDomainData<SeasonSummaryPageData>({
    fetcher: loadSeasonSummary,
  });

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  const userTeam = data
    ? (data.teams.find((team) => team.id === data.team.id) ?? data.teams[0])
    : null;
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
          {data.info.stage !== 'summary' ? (
            <StageUnavailableState
              title="Season summary unavailable"
              description="Final results are available only during the Season Summary stage."
              currentStage={data.info.stage}
            />
          ) : userTeam ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: { lg: 1 },
                minHeight: { lg: 0 },
                overflow: { lg: 'hidden' },
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 0.25, sm: 1.5 }}
                sx={{ alignItems: { sm: 'baseline' }, mb: 1 }}
              >
                <Typography component="h1" variant="h5" sx={{ fontWeight: 800 }}>
                  {data.info.currentYear} Season Summary
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  Champions, individual honors, and next season’s prestige movement.
                </Typography>
              </Stack>

              <SeasonOverview
                championship={data.championship}
                userTeam={userTeam}
                legacy={data.legacy}
                onTeamClick={handleTeamClick}
              />

              <Box
                sx={{
                  display: { xs: 'none', lg: 'grid' },
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gridTemplateRows: 'minmax(0, 1fr)',
                  gap: 1.25,
                  flex: 1,
                  minHeight: 0,
                  mt: 1,
                }}
              >
                <SeasonAwardsPanel
                  awards={data.awards}
                  userTeamName={userTeam.name}
                  onTeamClick={handleTeamClick}
                />
                <SeasonPrestigePanel teams={data.teams} onTeamClick={handleTeamClick} />
              </Box>

              <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 1 }}>
                <Tabs
                  value={activeDetail}
                  onChange={(_, value: SeasonSummaryDetail) => setActiveDetail(value)}
                  aria-label="Season summary details"
                  variant="fullWidth"
                  selectionFollowsFocus
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Tab
                    value="awards"
                    label="Awards"
                    id="summary-tab-awards"
                    aria-controls="summary-panel-awards"
                  />
                  <Tab
                    value="prestige"
                    label="Prestige"
                    id="summary-tab-prestige"
                    aria-controls="summary-panel-prestige"
                  />
                </Tabs>
                <Box
                  role="tabpanel"
                  id={`summary-panel-${activeDetail}`}
                  aria-labelledby={`summary-tab-${activeDetail}`}
                  sx={{ height: { xs: 'min(56vh, 540px)', md: 'min(58vh, 620px)' }, pt: 1.25 }}
                >
                  {activeDetail === 'awards' ? (
                    <SeasonAwardsPanel
                      awards={data.awards}
                      userTeamName={userTeam.name}
                      onTeamClick={handleTeamClick}
                    />
                  ) : (
                    <SeasonPrestigePanel
                      teams={data.teams}
                      onTeamClick={handleTeamClick}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography component="h1" variant="h6">
                Season summary unavailable
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Your team could not be found in the returned season data.
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

export default SeasonSummary;
