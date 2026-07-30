import { useMemo, useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { useDomainData } from '../domain/hooks';
import { loadRosterProgression } from '../domain/league/loaders/loadRosterProgression';
import type { RosterProgressionPageData } from '../types/pages';
import { DepartingPlayersPanel } from './roster-progression/DepartingPlayersPanel';
import { ProgressionSummary } from './roster-progression/ProgressionSummary';
import { ReturningPlayersPanel } from './roster-progression/ReturningPlayersPanel';

type ProgressionTab = 'returning' | 'departing';

const RosterProgression = () => {
  const [positionFilter, setPositionFilter] = useState('');
  const [activeTab, setActiveTab] = useState<ProgressionTab>('returning');

  const { data, loading, error } = useDomainData<RosterProgressionPageData>({
    fetcher: loadRosterProgression,
  });

  const returning = useMemo(
    () =>
      data?.returning.filter((player) => !positionFilter || player.position === positionFilter) ??
      [],
    [data, positionFilter],
  );
  const departing = useMemo(
    () =>
      data?.departing.filter((player) => !positionFilter || player.position === positionFilter) ??
      [],
    [data, positionFilter],
  );

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
        (data.info.stage !== 'progression' ? (
          <StageUnavailableState
            title="Roster progression unavailable"
            description="The roster-progression preview is available only during the Roster Progression stage."
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
            <Stack
              component="header"
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{
                alignItems: { sm: 'flex-end' },
                justifyContent: 'space-between',
                mb: 1.25,
              }}
            >
              <Box>
                <Typography component="h1" variant="h4">
                  Roster Progression
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  Projected roster changes for {data.info.currentYear}. Changes and senior
                  departures apply when you advance; recruits are generated afterward.
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 190 } }}>
                <InputLabel id="progression-position-label">Position</InputLabel>
                <Select
                  labelId="progression-position-label"
                  value={positionFilter}
                  label="Position"
                  onChange={(event) => setPositionFilter(event.target.value)}
                >
                  <MenuItem value="">All Positions</MenuItem>
                  {data.positions.map((position) => (
                    <MenuItem key={position} value={position}>
                      {position.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <ProgressionSummary summary={data.summary} />

            {data.summary.returningPlayers === 0 && data.summary.departingSeniors === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6">No progression preview available</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                  }}
                >
                  No players were returned for this roster.
                </Typography>
              </Paper>
            ) : (
              <>
                <Box
                  sx={{
                    display: { xs: 'none', lg: 'grid' },
                    gridTemplateColumns: 'minmax(0, 1.55fr) minmax(330px, 0.8fr)',
                    gap: 1.25,
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <ReturningPlayersPanel players={returning} filtered={Boolean(positionFilter)} />
                  <DepartingPlayersPanel players={departing} filtered={Boolean(positionFilter)} />
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
                      onChange={(_, value: ProgressionTab) => setActiveTab(value)}
                      variant="fullWidth"
                      aria-label="Roster progression groups"
                    >
                      <Tab value="returning" label={`Returning (${returning.length})`} />
                      <Tab value="departing" label={`Departures (${departing.length})`} />
                    </Tabs>
                  </Paper>
                  {activeTab === 'returning' ? (
                    <ReturningPlayersPanel players={returning} filtered={Boolean(positionFilter)} />
                  ) : (
                    <DepartingPlayersPanel players={departing} filtered={Boolean(positionFilter)} />
                  )}
                </Box>
              </>
            )}
          </Box>
        ))}
    </PageLayout>
  );
};

export default RosterProgression;
