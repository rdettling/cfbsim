import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import StageUnavailableState from '../components/layout/StageUnavailableState';
import { useDomainData } from '../domain/hooks';
import { loadRosterCuts } from '../domain/league/loaders/loadRosterCuts';
import { FINAL_ROSTER_SIZE } from '../domain/rosterConfig';
import type { RosterCutsPageData } from '../types/pages';
import { PositionLimitsPanel } from './roster-cuts/PositionLimitsPanel';
import { RosterCutsSummaryStrip } from './roster-cuts/RosterCutsSummaryStrip';
import { RosterSelectionPanel } from './roster-cuts/RosterSelectionPanel';
import { useRosterCutsActions } from './roster-cuts/useRosterCutsActions';

type RosterCutsTab = 'positions' | 'roster';
type StatusFilter =
  | ''
  | 'selected'
  | 'recommended'
  | 'protected'
  | 'available';

const RosterCuts = () => {
  const [selectedPosition, setSelectedPosition] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [activeTab, setActiveTab] = useState<RosterCutsTab>('roster');

  const { data, loading, error, refetch } =
    useDomainData<RosterCutsPageData>({
      fetcher: loadRosterCuts,
    });
  const {
    busyPlayerId,
    notice,
    setNotice,
    mutateCut,
  } = useRosterCutsActions(data, refetch);

  const players = useMemo(
    () =>
      data?.players.filter(player => {
        const positionMatches =
          !selectedPosition || player.position === selectedPosition;
        const statusMatches =
          !statusFilter ||
          (statusFilter === 'selected' && player.selected) ||
          (statusFilter === 'recommended' && player.recommended) ||
          (statusFilter === 'protected' && player.protected) ||
          (statusFilter === 'available' && player.canSelect);
        return positionMatches && statusMatches;
      }) ?? [],
    [data, selectedPosition, statusFilter],
  );

  const selectPosition = (position: string) => {
    setSelectedPosition(current => (current === position ? '' : position));
    setActiveTab('roster');
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
              advanceDisabled: busyPlayerId !== null,
            }
          : undefined
      }
    >
      {data &&
        (data.info.stage !== 'roster_cuts' || !data.cursor ? (
          <StageUnavailableState
            title="Roster cuts unavailable"
            description="Roster selections are available only during the Roster Cuts stage."
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
                  Roster Cuts
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Choose any returning players you want to cut. When you advance,
                  recommendations will complete the remaining cuts and finalize
                  the {FINAL_ROSTER_SIZE}-player roster.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="roster-cut-status-label">Status</InputLabel>
                  <Select
                    labelId="roster-cut-status-label"
                    value={statusFilter}
                    label="Status"
                    onChange={event =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                  >
                    <MenuItem value="">All Players</MenuItem>
                    <MenuItem value="selected">Selected</MenuItem>
                    <MenuItem value="recommended">Recommended</MenuItem>
                    <MenuItem value="protected">Protected</MenuItem>
                    <MenuItem value="available">Available</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>

            <RosterCutsSummaryStrip summary={data.summary} />

            <Box
              sx={{
                display: { xs: 'none', lg: 'grid' },
                gridTemplateColumns: 'minmax(330px, 0.72fr) minmax(0, 1.65fr)',
                gap: 1.25,
                flex: 1,
                minHeight: 0,
              }}
            >
              <PositionLimitsPanel
                positions={data.positions}
                selectedPosition={selectedPosition}
                onSelect={position => selectPosition(position)}
              />
              <RosterSelectionPanel
                players={players}
                filtered={Boolean(selectedPosition || statusFilter)}
                busyPlayerId={busyPlayerId}
                onSelect={playerId => void mutateCut(playerId, 'select')}
                onUndo={playerId => void mutateCut(playerId, 'undo')}
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
                  aria-label="Roster cuts sections"
                >
                  <Tab value="positions" label="Positions" />
                  <Tab value="roster" label={`Roster (${players.length})`} />
                </Tabs>
              </Paper>
              {activeTab === 'positions' ? (
                <PositionLimitsPanel
                  positions={data.positions}
                  selectedPosition={selectedPosition}
                  onSelect={position => selectPosition(position)}
                />
              ) : (
                <RosterSelectionPanel
                  players={players}
                  filtered={Boolean(selectedPosition || statusFilter)}
                  busyPlayerId={busyPlayerId}
                  onSelect={playerId => void mutateCut(playerId, 'select')}
                  onUndo={playerId => void mutateCut(playerId, 'undo')}
                />
              )}
            </Box>
          </Box>
        ))}

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={8000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setNotice(null)}
            role="status"
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </PageLayout>
  );
};

export default RosterCuts;
