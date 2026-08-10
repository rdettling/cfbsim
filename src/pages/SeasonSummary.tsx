import { useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadSeasonSummary } from '../domain/league/loaders/offseason';
import type { SeasonSummaryPageData } from '../types/pages';
import { SeasonAwardsPanel } from './season-summary/SeasonAwardsPanel';
import { SeasonOverview } from './season-summary/SeasonOverview';
import { SeasonPrestigePanel } from './season-summary/SeasonPrestigePanel';
import type { SeasonSummaryDetail } from './season-summary/types';
import { SeasonLegacyPanel } from './season-summary/SeasonLegacyPanel';

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

  const orderedPrestigeChanges = (data?.teams ?? [])
    .filter((team) => (team.prestige_change ?? 0) !== 0)
    .slice()
    .sort((a, b) => {
      const changeDifference = (b.prestige_change ?? 0) - (a.prestige_change ?? 0);
      return changeDifference || a.name.localeCompare(b.name);
    });

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
              }}
            >
              <Box sx={{ mb: 1.25 }}>
                <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>
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
              </Box>

              <SeasonOverview
                champion={data.champion}
                userTeam={userTeam}
                onTeamClick={handleTeamClick}
              />
              {data.legacy && <SeasonLegacyPanel legacy={data.legacy} />}

              <Box
                sx={{
                  display: { xs: 'none', lg: 'grid' },
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gridTemplateRows: 'minmax(0, 1fr)',
                  gap: 1.25,
                  flex: 1,
                  minHeight: 0,
                  mt: 1.25,
                }}
              >
                <SeasonAwardsPanel awards={data.awards} onTeamClick={handleTeamClick} />
                <SeasonPrestigePanel teams={orderedPrestigeChanges} onTeamClick={handleTeamClick} />
              </Box>

              <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 1.25 }}>
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
                    <SeasonAwardsPanel awards={data.awards} onTeamClick={handleTeamClick} />
                  ) : (
                    <SeasonPrestigePanel
                      teams={orderedPrestigeChanges}
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
