import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  Alert,
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
import { TeamHeader } from '../components/team/TeamHeader';
import { SeasonSelect } from '../components/stats/SeasonSelect';
import { useDomainData } from '../domain/hooks';
import { loadTeamStats } from '../domain/league/loaders/team/loadTeamStats';
import type { TeamStatsPageData } from '../types/pages';
import type {
  SortDirection,
  TeamAggregateMode,
  TeamPlayerStatKey,
  TeamPlayerStatsCategory,
} from '../types/stats';
import {
  DEFAULT_TEAM_PLAYER_SORT,
  TEAM_PLAYER_CATEGORY_LABELS,
  TEAM_PLAYER_COLUMNS,
} from './team-stats/config';
import { TeamAggregatePanel } from './team-stats/TeamAggregatePanel';
import { TeamPlayerStatsDesktopTable } from './team-stats/TeamPlayerStatsDesktopTable';
import { TeamPlayerStatsMobileList } from './team-stats/TeamPlayerStatsMobileList';
import type { TeamPlayerDisplayRow } from './team-stats/types';
import { getTeamStatsPath } from '../constants/routes';

type StatisticsSection = 'team' | 'players';

const TeamStats = () => {
  const { teamName, year } = useParams();
  const navigate = useNavigate();
  const [section, setSection] = useState<StatisticsSection>('team');
  const [teamMode, setTeamMode] = useState<TeamAggregateMode>('offense');
  const [playerCategory, setPlayerCategory] = useState<TeamPlayerStatsCategory>('passing');
  const [sortKey, setSortKey] = useState(DEFAULT_TEAM_PLAYER_SORT.passing);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { data, loading, error } = useDomainData<TeamStatsPageData>({
    fetcher: () => loadTeamStats(teamName, year ? Number(year) : undefined),
    deps: [teamName, year],
  });

  useEffect(() => {
    document.title = teamName ? `${teamName} Statistics` : 'Team Statistics';
    return () => {
      document.title = 'College Football';
    };
  }, [teamName]);

  const columns = TEAM_PLAYER_COLUMNS[playerCategory];
  const rows = useMemo(() => {
    if (!data) return [];
    return data.playerStats[playerCategory]
      .map<TeamPlayerDisplayRow>(player => ({
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        stats: player.stats,
      }))
      .sort((left, right) => {
        const difference = (left.stats[sortKey] ?? 0) - (right.stats[sortKey] ?? 0);
        if (difference !== 0) return sortDirection === 'asc' ? difference : -difference;
        return `${left.last},${left.first}`.localeCompare(`${right.last},${right.first}`);
      });
  }, [data, playerCategory, sortDirection, sortKey]);

  const handlePlayerCategoryChange = (category: TeamPlayerStatsCategory) => {
    setPlayerCategory(category);
    setSortKey(DEFAULT_TEAM_PLAYER_SORT[category]);
    setSortDirection('desc');
  };

  const handleSort = (key: TeamPlayerStatKey) => {
    if (key === sortKey) {
      setSortDirection(current => current === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const isPreseason =
    data?.selectedYear === data?.info.currentYear &&
    data?.teamStats.offense.values.games === 0;

  const statsPath = (team: string, selectedYear: number) =>
    getTeamStatsPath(
      team,
      selectedYear === data?.info.currentYear ? undefined : selectedYear,
    );

  return (
    <PageLayout
      loading={loading}
      error={error}
      containerMaxWidth="xl"
      desktopViewportConstrained
      navbarData={data ?? undefined}
    >
      {data && (
        <Stack
          spacing={1.5}
          sx={{
            minHeight: { lg: 0 },
            height: { lg: '100%' },
            overflow: { lg: 'hidden' },
          }}
        >
          <TeamHeader
            team={data.team}
            teamSelector={{
              teams: data.teams,
              onChange: name => navigate(statsPath(name, data.selectedYear)),
            }}
            controls={
              <SeasonSelect
                years={data.years}
                selectedYear={data.selectedYear}
                onChange={selectedYear =>
                  navigate(statsPath(data.team.name, selectedYear))
                }
              />
            }
          />

          {isPreseason && (
            <Alert severity="info">
              No games have been completed. Season statistics are currently zero.
            </Alert>
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Tabs
              value={section}
              onChange={(_, value: StatisticsSection) => setSection(value)}
              aria-label="Statistics section"
              sx={{ minHeight: 44 }}
            >
              <Tab
                id="team-statistics-tab"
                aria-controls="team-statistics-panel"
                value="team"
                label="Team Statistics"
                sx={{ minHeight: 44 }}
              />
              <Tab
                id="player-statistics-tab"
                aria-controls="player-statistics-panel"
                value="players"
                label="Player Statistics"
                sx={{ minHeight: 44 }}
              />
            </Tabs>
          </Box>

          <Stack
            id="team-statistics-panel"
            role="tabpanel"
            aria-labelledby="team-statistics-tab"
            hidden={section !== 'team'}
            spacing={1}
            sx={{
              display: section === 'team' ? 'flex' : 'none',
              flex: { lg: 1 },
              minHeight: { lg: 0 },
              overflowY: { lg: 'auto' },
              pr: { lg: 0.5 },
            }}
          >
            <Tabs
              value={teamMode}
              onChange={(_, value: TeamAggregateMode) => setTeamMode(value)}
              aria-label="Team statistics category"
              sx={{ minHeight: 36, flexShrink: 0 }}
            >
              <Tab value="offense" label="Offense" sx={{ minHeight: 36, py: 0 }} />
              <Tab value="defense" label="Defense" sx={{ minHeight: 36, py: 0 }} />
            </Tabs>
            <TeamAggregatePanel mode={teamMode} stats={data.teamStats[teamMode]} />
          </Stack>

          <Stack
            id="player-statistics-panel"
            role="tabpanel"
            aria-labelledby="player-statistics-tab"
            hidden={section !== 'players'}
            spacing={0.75}
            sx={{
              display: section === 'players' ? 'flex' : 'none',
              flex: { lg: 1 },
              minHeight: { lg: 0 },
            }}
          >
            <Stack
              direction="row"
              sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}
            >
              <Tabs
                value={playerCategory}
                onChange={(_, value: TeamPlayerStatsCategory) => handlePlayerCategoryChange(value)}
                aria-label="Player statistics category"
                variant="scrollable"
                scrollButtons={false}
                sx={{ minHeight: 40, flex: 1 }}
              >
                {(Object.keys(TEAM_PLAYER_CATEGORY_LABELS) as TeamPlayerStatsCategory[]).map(category => (
                  <Tab
                    key={category}
                    value={category}
                    label={TEAM_PLAYER_CATEGORY_LABELS[category]}
                    sx={{ minHeight: 40 }}
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

            <FormControl
              size="small"
              sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 190 }}
            >
              <InputLabel id="team-player-stat-sort-label">Sort by</InputLabel>
              <Select
                labelId="team-player-stat-sort-label"
                value={sortKey}
                label="Sort by"
                onChange={event => handleSort(event.target.value)}
              >
                {columns.map(column => (
                  <MenuItem key={column.key} value={column.sortKey}>
                    {column.mobileLabel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {rows.length > 0 ? (
              <>
                <TeamPlayerStatsDesktopTable
                  rows={rows}
                  columns={columns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
                <TeamPlayerStatsMobileList
                  rows={rows}
                  columns={columns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </>
            ) : (
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle1">
                  No {TEAM_PLAYER_CATEGORY_LABELS[playerCategory].toLowerCase()} statistics available
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                  Players will appear after recording activity in this category.
                </Typography>
              </Paper>
            )}
          </Stack>
        </Stack>
      )}
    </PageLayout>
  );
};

export default TeamStats;
