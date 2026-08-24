import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { SeasonSelect } from '../components/stats/SeasonSelect';
import { useDomainData } from '../domain/hooks';
import { loadPlayerLeaders } from '../domain/league/loaders/stats/playerLeaders';
import type { PlayerLeadersPageData } from '../types/pages';
import type {
  PlayerLeaderboardCategory,
  PlayerLeaderboardStatKey,
  SortDirection,
} from '../types/stats';
import {
  CATEGORY_LABELS,
  DEFAULT_PLAYER_LEADER_SORT,
  PLAYER_LEADER_COLUMNS,
} from './player-leaders/config';
import { PlayerLeadersDesktopTable } from './player-leaders/PlayerLeadersDesktopTable';
import { PlayerLeadersMobileList } from './player-leaders/PlayerLeadersMobileList';

const PlayerLeaders = () => {
  const { year } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState<PlayerLeaderboardCategory>('passing');
  const [sortKey, setSortKey] = useState(DEFAULT_PLAYER_LEADER_SORT.passing);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<PlayerLeadersPageData>({
    fetcher: () => loadPlayerLeaders(year ? Number(year) : undefined),
    deps: [year],
  });
  const columns = PLAYER_LEADER_COLUMNS[category];

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
        stats: player.stats,
      }))
      .sort((a, b) => {
        const difference = (a.stats[sortKey] ?? 0) - (b.stats[sortKey] ?? 0);
        if (difference !== 0) {
          return sortDirection === 'asc' ? difference : -difference;
        }
        return `${a.last},${a.first}`.localeCompare(`${b.last},${b.first}`);
      })
      .map((player, index) => ({ ...player, rank: index + 1 }));
  }, [category, data, sortDirection, sortKey]);

  const handleCategoryChange = (nextCategory: PlayerLeaderboardCategory) => {
    setCategory(nextCategory);
    setSortKey(DEFAULT_PLAYER_LEADER_SORT[nextCategory]);
    setSortDirection('desc');
  };

  const handleSort = (key: PlayerLeaderboardStatKey) => {
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
      navbarData={data ?? undefined}
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
                Player Leaders
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {data.selectedYear === data.info.currentYear
                  ? `${data.selectedYear} season · Week ${data.info.currentWeek}`
                  : `${data.selectedYear} season · Final`}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <SeasonSelect
                years={data.years}
                selectedYear={data.selectedYear}
                onChange={selectedYear =>
                  navigate(
                    selectedYear === data.info.currentYear
                      ? '/stats/players'
                      : `/stats/players/${selectedYear}`,
                  )
                }
              />
              <FormControl size="small" sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 220 }}>
              <InputLabel id="player-leader-sort-label">Rank by</InputLabel>
              <Select
                labelId="player-leader-sort-label"
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
              onChange={(_, value: PlayerLeaderboardCategory) => handleCategoryChange(value)}
              aria-label="Player leader category"
              variant="scrollable"
              scrollButtons={false}
              sx={{ minHeight: 40, flex: 1 }}
            >
              {(Object.keys(CATEGORY_LABELS) as PlayerLeaderboardCategory[]).map((key) => (
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
              <PlayerLeadersDesktopTable
                rows={rows}
                columns={columns}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onTeamClick={handleTeamClick}
              />
              <PlayerLeadersMobileList
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
            statsYear={
              data.selectedYear === data.info.currentYear
                ? undefined
                : data.selectedYear
            }
          />
        </>
      )}
    </PageLayout>
  );
};

export default PlayerLeaders;
