import { useMemo, useState } from 'react';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  Alert,
  Box,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadTeamStats } from '../domain/league';
import type { TeamStatsPageData } from '../types/pages';
import type {
  SortDirection,
  TeamStatKey,
  TeamStatsMode,
} from '../types/stats';
import {
  getDefaultDirection,
  TEAM_STAT_COLUMNS,
  TEAM_STAT_GROUPS,
} from './team-stats/config';
import { TeamStatsDesktopTable } from './team-stats/TeamStatsDesktopTable';
import { TeamStatsMobileList } from './team-stats/TeamStatsMobileList';

const TeamStats = () => {
  const [mode, setMode] = useState<TeamStatsMode>('offense');
  const [sortKey, setSortKey] = useState<TeamStatKey>('ppg');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<TeamStatsPageData>({
    fetcher: loadTeamStats,
  });

  const stats = data?.[mode] ?? {};
  const averages = data?.[`${mode}_averages`] ?? null;
  const rows = useMemo(
    () =>
      Object.entries(stats)
        .sort(([, a], [, b]) => {
          const difference = a[sortKey] - b[sortKey];
          return sortDirection === 'asc' ? difference : -difference;
        })
        .map(([teamName, teamStats], index) => ({
          teamName,
          stats: teamStats,
          rank: index + 1,
        })),
    [sortDirection, sortKey, stats]
  );

  const handleModeChange = (nextMode: TeamStatsMode) => {
    setMode(nextMode);
    setSortKey('ppg');
    setSortDirection(nextMode === 'offense' ? 'desc' : 'asc');
  };

  const handleSort = (key: TeamStatKey) => {
    if (key === sortKey) {
      setSortDirection(current => current === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection(getDefaultDirection(key, mode));
    }
  };

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  const isPreseason = rows.length > 0 && rows.every(row => row.stats.games === 0);

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
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mb: 1.25 }}
          >
            <Box>
              <Typography component="h1" variant="h4">Team Statistics</Typography>
              <Typography variant="body2" color="text.secondary">
                {data.info.currentYear} season · Week {data.info.currentWeek}
              </Typography>
            </Box>
            <FormControl size="small" sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 220 }}>
              <InputLabel id="team-stat-sort-label">Rank by</InputLabel>
              <Select
                labelId="team-stat-sort-label"
                value={sortKey}
                label="Rank by"
                onChange={event => handleSort(event.target.value as TeamStatKey)}
              >
                {TEAM_STAT_GROUPS.flatMap(group => [
                  <ListSubheader key={`${group}-header`}>{group}</ListSubheader>,
                  ...TEAM_STAT_COLUMNS.filter(column => column.group === group).map(column => (
                    <MenuItem key={column.key} value={column.key}>{column.mobileLabel}</MenuItem>
                  )),
                ])}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" alignItems="center" sx={{ mb: 1.25, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={mode}
              onChange={(_, value: TeamStatsMode) => handleModeChange(value)}
              aria-label="Team statistics type"
              sx={{ minHeight: 40, flex: 1 }}
            >
              <Tab value="offense" label="Offense" sx={{ minHeight: 40 }} />
              <Tab value="defense" label="Defense" sx={{ minHeight: 40 }} />
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

          {isPreseason && (
            <Alert severity="info" sx={{ mb: 1.25 }}>
              No games have been completed. Season statistics are currently zero.
            </Alert>
          )}

          {rows.length > 0 && averages ? (
            <>
              <TeamStatsDesktopTable
                rows={rows}
                averages={averages}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
              <TeamStatsMobileList
                rows={rows}
                averages={averages}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No team statistics available</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Team statistics will appear when teams are available.
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

export default TeamStats;
