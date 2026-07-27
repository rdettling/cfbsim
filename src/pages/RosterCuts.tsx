import { useMemo, useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { useDomainData } from '../domain/hooks';
import { loadRosterCuts } from '../domain/league/loaders/loadRosterCuts';
import type { RosterCutsPageData } from '../types/pages';
import { PositionLimitsPanel } from './roster-cuts/PositionLimitsPanel';
import { ProjectedCutsPanel } from './roster-cuts/ProjectedCutsPanel';
import { RosterCutsSummaryStrip } from './roster-cuts/RosterCutsSummaryStrip';

type RosterCutsTab = 'positions' | 'cuts';

const RosterCuts = () => {
  const [selectedPosition, setSelectedPosition] = useState('');
  const [activeTab, setActiveTab] = useState<RosterCutsTab>('positions');
  const { data, loading, error } = useDomainData<RosterCutsPageData>({
    fetcher: loadRosterCuts,
  });

  const cuts = useMemo(
    () =>
      data?.cuts.filter((player) => !selectedPosition || player.position === selectedPosition) ??
      [],
    [data, selectedPosition],
  );

  const selectPosition = (position: string, hasCuts: boolean) => {
    setSelectedPosition((current) => (current === position ? '' : position));
    if (hasCuts) setActiveTab('cuts');
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
      {data &&
        (data.info.stage !== 'roster_cuts' ? (
          <StageUnavailableState
            title="Roster cuts unavailable"
            description="The roster-cuts preview is available only during the Roster Cuts stage."
            currentStage={data.info.stage}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: { lg: 1 },
              minHeight: { lg: 0 },
            }}
          >
            <Box component="header" sx={{ mb: 1.25 }}>
              <Typography component="h1" variant="h4">
                Roster Cuts
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Projected automatic cuts for {data.info.currentYear}. No cuts have been applied.
                Advancing applies cuts to every team, selects starters, recalculates ratings, resets
                the season, and enters Preseason.
              </Typography>
            </Box>

            <RosterCutsSummaryStrip summary={data.summary} />

            {data.summary.activePlayers === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6">No roster available</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                  }}
                >
                  No active players were returned for your team.
                </Typography>
              </Paper>
            ) : (
              <>
                <Box
                  sx={{
                    display: { xs: 'none', lg: 'grid' },
                    gridTemplateColumns: 'minmax(340px, 0.8fr) minmax(0, 1.45fr)',
                    gap: 1.25,
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <PositionLimitsPanel
                    positions={data.positions}
                    selectedPosition={selectedPosition}
                    onSelect={selectPosition}
                  />
                  <ProjectedCutsPanel
                    cuts={cuts}
                    selectedPosition={selectedPosition}
                    totalCuts={data.summary.projectedCuts}
                  />
                </Box>

                <Box
                  sx={{
                    display: { xs: 'flex', lg: 'none' },
                    flexDirection: 'column',
                    minHeight: 0,
                  }}
                >
                  <Paper variant="outlined" sx={{ mb: 1.25 }}>
                    <Tabs
                      value={activeTab}
                      onChange={(_, value: RosterCutsTab) => setActiveTab(value)}
                      variant="fullWidth"
                      aria-label="Roster cuts preview sections"
                    >
                      <Tab value="positions" label="Position Limits" />
                      <Tab value="cuts" label={`Projected Cuts (${data.summary.projectedCuts})`} />
                    </Tabs>
                  </Paper>
                  {activeTab === 'positions' ? (
                    <PositionLimitsPanel
                      positions={data.positions}
                      selectedPosition={selectedPosition}
                      onSelect={selectPosition}
                    />
                  ) : (
                    <ProjectedCutsPanel
                      cuts={cuts}
                      selectedPosition={selectedPosition}
                      totalCuts={data.summary.projectedCuts}
                    />
                  )}
                </Box>
              </>
            )}
          </Box>
        ))}
    </PageLayout>
  );
};

export default RosterCuts;
