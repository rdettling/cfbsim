import { useMemo, useState } from 'react';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadLeagueRecords } from '../domain/league/loaders/leagueRecords';
import type { LeagueRecordsPageData } from '../types/pages';
import {
  getDefaultLeagueRecordsDirection,
  LEAGUE_RECORDS_COLUMNS,
  type LeagueRecordsSortDirection,
  type LeagueRecordsSortKey,
} from './league-records/config';
import { LeagueRecordsDesktopTable } from './league-records/LeagueRecordsDesktopTable';
import { LeagueRecordsMobileList } from './league-records/LeagueRecordsMobileList';
import { sortLeagueRecords } from './league-records/sorting';

const coverageLabel = (data: LeagueRecordsPageData) => {
  const completed = data.coverage.firstCompletedYear === null
    ? 'No completed seasons recorded'
    : `Completed seasons ${data.coverage.firstCompletedYear}–${data.coverage.lastCompletedYear}`;
  const dynasty = data.coverage.firstDynastyYear === null
    ? 'No dynasty seasons archived'
    : `Dynasty honors ${data.coverage.firstDynastyYear}–${data.coverage.lastDynastyYear}`;
  return `${completed} · ${dynasty}`;
};

const LeagueRecords = () => {
  const [sortKey, setSortKey] = useState<LeagueRecordsSortKey>('wins');
  const [sortDirection, setSortDirection] = useState<LeagueRecordsSortDirection>('desc');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<LeagueRecordsPageData>({
    fetcher: loadLeagueRecords,
    deps: [],
  });
  const rows = useMemo(
    () => sortLeagueRecords(data?.programs ?? [], sortKey, sortDirection),
    [data?.programs, sortDirection, sortKey],
  );
  const handleSort = (key: LeagueRecordsSortKey) => {
    if (key === sortKey) {
      setSortDirection(current => current === 'desc' ? 'asc' : 'desc');
      return;
    }
    setSortKey(key);
    setSortDirection(getDefaultLeagueRecordsDirection(key));
  };
  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth={false}
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
            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', mb: 1.5 }}
          >
            <Box>
              <Typography component="h1" variant="h4">League Records</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {coverageLabel(data)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                <InputLabel id="league-records-sort-label">Rank by</InputLabel>
                <Select
                  labelId="league-records-sort-label"
                  value={sortKey}
                  label="Rank by"
                  onChange={event => handleSort(event.target.value as LeagueRecordsSortKey)}
                >
                  {LEAGUE_RECORDS_COLUMNS.map(column => (
                    <MenuItem key={column.key} value={column.key}>{column.mobileLabel}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title={sortDirection === 'desc' ? 'Descending' : 'Ascending'}>
                <IconButton
                  aria-label={`Sort ${sortDirection === 'desc' ? 'ascending' : 'descending'}`}
                  onClick={() => setSortDirection(current => current === 'desc' ? 'asc' : 'desc')}
                >
                  {sortDirection === 'desc' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {data.hasCompletedSeasons ? (
            <>
              <LeagueRecordsDesktopTable
                rows={rows}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
              <LeagueRecordsMobileList
                rows={rows}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No completed seasons recorded</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                League records will appear after completed season data is available.
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

export default LeagueRecords;
