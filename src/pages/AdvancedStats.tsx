import { useMemo, useState } from 'react';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadAdvancedStats } from '../domain/league/loaders/stats/advancedStats';
import type { AdvancedStatsPageData } from '../types/pages';
import { AdvancedStatsDesktopTable } from './advanced-stats/AdvancedStatsDesktopTable';
import { AdvancedStatsGlossaryDialog } from './advanced-stats/AdvancedStatsGlossaryDialog';
import { AdvancedStatsMobileList } from './advanced-stats/AdvancedStatsMobileList';
import {
  ADVANCED_SORT_COLUMNS,
  ADVANCED_STATS_MODES,
  DEFAULT_ADVANCED_METRIC,
  DEFAULT_ADVANCED_STATS_MODE,
  sortAdvancedStatsRows,
  type AdvancedMetricKey,
  type AdvancedSortDirection,
  type AdvancedStatsMode,
} from './advanced-stats/config';

const AdvancedStats = () => {
  const [mode, setMode] = useState<AdvancedStatsMode>(DEFAULT_ADVANCED_STATS_MODE);
  const [sortKey, setSortKey] = useState<AdvancedMetricKey>('performanceIndex');
  const [sortDirection, setSortDirection] = useState<AdvancedSortDirection>('desc');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const { data, loading, error } = useDomainData<AdvancedStatsPageData>({
    fetcher: loadAdvancedStats,
  });
  const rows = useMemo(() => sortAdvancedStatsRows(
    data?.rows ?? [],
    mode,
    sortKey,
    sortDirection,
  ), [data?.rows, mode, sortDirection, sortKey]);

  const changeMode = (nextMode: AdvancedStatsMode) => {
    const nextMetric = DEFAULT_ADVANCED_METRIC[nextMode];
    setMode(nextMode);
    setSortKey(nextMetric);
    setSortDirection(nextMode === 'poll' ? 'asc' : 'desc');
  };
  const sort = (key: AdvancedMetricKey) => {
    const column = ADVANCED_SORT_COLUMNS[mode].find(entry => entry.key === key)!;
    if (key === sortKey) {
      setSortDirection(current => current === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection(column.direction);
    }
  };
  const openTeam = (teamName: string) => {
    setSelectedTeam(teamName);
    setTeamModalOpen(true);
  };
  const preseason = rows.every(row => row.games === 0);
  const viewProps = {
    rows,
    mode,
    sortKey,
    sortDirection,
    onSort: sort,
    onTeamClick: openTeam,
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ? {
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences,
      } : undefined}
    >
      {data && (
        <>
          <Stack
            component="header"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', mb: 1.25 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Typography
                  component="h1"
                  variant="h4"
                  sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
                >
                  Advanced Statistics
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => setGlossaryOpen(true)}
                  sx={{
                    flexShrink: 0,
                    height: { xs: 36, sm: 42 },
                    px: { xs: 1.5, sm: 2 },
                    fontWeight: 700,
                  }}
                >
                  Glossary
                </Button>
              </Stack>
            </Box>
            <FormControl
              size="small"
              sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 230 }}
            >
              <InputLabel id="advanced-stat-sort-label">Rank by</InputLabel>
              <Select
                labelId="advanced-stat-sort-label"
                value={sortKey}
                label="Rank by"
                onChange={event => sort(event.target.value as AdvancedMetricKey)}
              >
                {ADVANCED_SORT_COLUMNS[mode].map(column => (
                  <MenuItem key={column.key} value={column.key}>
                    {column.mobileLabel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack
            direction="row"
            sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider', mb: 1.25 }}
          >
            <Tabs
              value={mode}
              onChange={(_, value: AdvancedStatsMode) => changeMode(value)}
              aria-label="Advanced statistics type"
              sx={{ flex: 1, minWidth: 0, minHeight: 40 }}
            >
              {ADVANCED_STATS_MODES.map(entry => (
                <Tab
                  key={entry.value}
                  value={entry.value}
                  label={entry.label}
                  sx={{
                    minHeight: 40,
                    minWidth: { xs: 0, sm: 90 },
                    px: { xs: 0.5, sm: 2 },
                    fontSize: { xs: '0.72rem', sm: '0.875rem' },
                    flex: { xs: 1, sm: 'none' },
                  }}
                />
              ))}
            </Tabs>
            <Tooltip title={sortDirection === 'desc' ? 'Descending' : 'Ascending'}>
              <IconButton
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                aria-label={`Sort ${sortDirection === 'desc' ? 'ascending' : 'descending'}`}
                onClick={() => setSortDirection(current => current === 'desc' ? 'asc' : 'desc')}
              >
                {sortDirection === 'desc' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
              </IconButton>
            </Tooltip>
          </Stack>

          {preseason && (
            <Alert severity="info" sx={{ mb: 1.25 }}>
              No games are complete. Performance and résumé metrics will appear
              after Week 1; preseason Poll Score, Team Rating, and Team Score remain available.
            </Alert>
          )}
          <AdvancedStatsDesktopTable {...viewProps} />
          <AdvancedStatsMobileList {...viewProps} />
          <TeamInfoModal
            teamName={selectedTeam}
            open={teamModalOpen}
            onClose={() => setTeamModalOpen(false)}
          />
          <AdvancedStatsGlossaryDialog
            open={glossaryOpen}
            onClose={() => setGlossaryOpen(false)}
          />
        </>
      )}
    </PageLayout>
  );
};

export default AdvancedStats;
