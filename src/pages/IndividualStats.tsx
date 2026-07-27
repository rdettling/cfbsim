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
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamComponents';
import { useDomainData } from '../domain/hooks';
import { loadIndividualStats } from '../domain/league';
import type { IndividualStatsPageData } from '../types/pages';
import type { IndividualStatsCategory, SortDirection } from '../types/stats';
import {
  CATEGORY_LABELS,
  DEFAULT_INDIVIDUAL_SORT,
  INDIVIDUAL_COLUMNS,
} from './individual-stats/config';
import { IndividualStatsDesktopTable } from './individual-stats/IndividualStatsDesktopTable';
import { IndividualStatsMobileList } from './individual-stats/IndividualStatsMobileList';

const IndividualStats = () => {
  const [category, setCategory] = useState<IndividualStatsCategory>('passing');
  const [sortKey, setSortKey] = useState(DEFAULT_INDIVIDUAL_SORT.passing);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<IndividualStatsPageData>({
    fetcher: loadIndividualStats,
  });
  const columns = INDIVIDUAL_COLUMNS[category];

  const rows = useMemo(() => {
    if (!data) return [];
    return Object.values(data.stats[category])
      .map((player) => ({
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        team: player.team,
        gamesPlayed: player.gamesPlayed,
        stats: Object.fromEntries(Object.entries(player.stats)) as Record<string, number>,
      }))
      .sort((a, b) => {
        const difference = (a.stats[sortKey] ?? 0) - (b.stats[sortKey] ?? 0);
        return sortDirection === 'asc' ? difference : -difference;
      })
      .map((player, index) => ({ ...player, rank: index + 1 }));
  }, [category, data, sortDirection, sortKey]);

  const handleCategoryChange = (nextCategory: IndividualStatsCategory) => {
    setCategory(nextCategory);
    setSortKey(DEFAULT_INDIVIDUAL_SORT[nextCategory]);
    setSortDirection('desc');
  };

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

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
          <Stack
            component="header"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              mb: 1.25,
            }}
          >
            <Box>
              <Typography component="h1" variant="h4">
                Individual Statistics
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {data.info.currentYear} season · Week {data.info.currentWeek}
              </Typography>
            </Box>
            <FormControl size="small" sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 220 }}>
              <InputLabel id="individual-stat-sort-label">Rank by</InputLabel>
              <Select
                labelId="individual-stat-sort-label"
                value={sortKey}
                label="Rank by"
                onChange={(event) => handleSort(event.target.value)}
              >
                {columns.map((column) => (
                  <MenuItem key={column.key} value={column.key}>
                    {column.mobileLabel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              mb: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tabs
              value={category}
              onChange={(_, value: IndividualStatsCategory) => handleCategoryChange(value)}
              aria-label="Individual statistics category"
              variant="scrollable"
              scrollButtons={false}
              sx={{ minHeight: 40, flex: 1 }}
            >
              {(Object.keys(CATEGORY_LABELS) as IndividualStatsCategory[]).map((key) => (
                <Tab key={key} value={key} label={CATEGORY_LABELS[key]} sx={{ minHeight: 40 }} />
              ))}
            </Tabs>
            <Tooltip title={sortDirection === 'desc' ? 'Descending' : 'Ascending'}>
              <IconButton
                sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                aria-label={`Sort ${sortDirection === 'desc' ? 'ascending' : 'descending'}`}
                onClick={() => setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
              >
                {sortDirection === 'desc' ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
              </IconButton>
            </Tooltip>
          </Stack>

          {rows.length > 0 ? (
            <>
              <IndividualStatsDesktopTable
                rows={rows}
                columns={columns}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
              <IndividualStatsMobileList
                rows={rows}
                columns={columns}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">
                No {CATEGORY_LABELS[category].toLowerCase()} statistics available
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                Qualified players will appear after enough games have been completed.
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

export default IndividualStats;
