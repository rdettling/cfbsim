import { useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadAwards } from '../domain/league/loaders/offseason';
import type { AwardsPageData } from '../types/pages';
import { AwardDetail } from './awards/AwardDetail';
import { AwardsCategoryNavigation } from './awards/AwardsCategoryNavigation';
import { AwardsHeader } from './awards/AwardsHeader';
import type { AwardMode } from './awards/types';
import { AwardsHistory } from './awards/AwardsHistory';

const Awards = () => {
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<'current' | 'history'>('current');

  const { data, loading, error } = useDomainData<AwardsPageData>({
    fetcher: loadAwards,
  });

  const mode: AwardMode = data?.info.stage === 'summary' ? 'final' : 'live';
  const awards = data ? (mode === 'final' ? data.final : data.favorites) : [];
  const selectedAward =
    awards.find((award) => award.category_slug === selectedSlug) ?? awards[0] ?? null;
  const hasAnyCandidate = awards.some(
    (award) =>
      award.first_place !== null || award.second_place !== null || award.third_place !== null,
  );

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
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: { lg: 1 },
              minHeight: { lg: 0 },
            }}
          >
            <AwardsHeader year={data.info.currentYear} week={data.info.currentWeek} mode={mode} />
            <Tabs
              value={view}
              onChange={(_, value: 'current' | 'history') => setView(value)}
              aria-label="Awards views"
              sx={{ mb: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Tab value="current" label="Current Season" />
              <Tab value="history" label="History" />
            </Tabs>

            {view === 'history' ? (
              <AwardsHistory history={data.history} onTeamClick={handleTeamClick} />
            ) : !hasAnyCandidate ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6">No award candidates yet</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                  }}
                >
                  Awards will populate after eligible players record game statistics.
                </Typography>
              </Paper>
            ) : selectedAward ? (
              <Box
                sx={{
                  display: { xs: 'block', lg: 'grid' },
                  gridTemplateColumns: { lg: 'minmax(250px, 0.3fr) minmax(0, 1fr)' },
                  gridTemplateRows: { lg: 'minmax(0, 1fr)' },
                  gap: 1.25,
                  flex: { lg: 1 },
                  minHeight: { lg: 0 },
                }}
              >
                <AwardsCategoryNavigation
                  awards={awards}
                  selectedSlug={selectedAward.category_slug}
                  mode={mode}
                  onSelect={setSelectedSlug}
                />
                <AwardDetail award={selectedAward} mode={mode} onTeamClick={handleTeamClick} />
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6">Awards are unavailable</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                  }}
                >
                  No award categories were returned for this season.
                </Typography>
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
