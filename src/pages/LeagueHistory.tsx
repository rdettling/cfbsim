import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { TeamLink } from '../components/team/TeamLink';
import { TeamLogo } from '../components/team/TeamLogo';
import { getLeagueHistoryPath } from '../constants/routes';
import { useDomainData } from '../domain/hooks';
import { loadLeagueHistory } from '../domain/league/loaders/leagueHistory';
import type { LeagueHistoryPageData } from '../types/pages';
import { AwardsBoard } from './awards/AwardsBoard';
import { PostseasonBowlView } from './playoff/PostseasonBowlView';
import { PostseasonBracketView } from './playoff/PostseasonBracketView';
import type { PostseasonFormat } from './playoff/types';

type HistorySeason = NonNullable<LeagueHistoryPageData['season']>;
type TabId = 'overview' | 'playoff' | 'bowls' | 'awards';

const TAB_IDS = new Set<TabId>(['overview', 'playoff', 'bowls', 'awards']);

const getSelectedTab = (value: string | null): TabId =>
  value !== null && TAB_IDS.has(value as TabId) ? value as TabId : 'overview';

const TeamButton = ({ name, onTeamClick }: { name: string; onTeamClick: (name: string) => void }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
    <TeamLogo name={name} size={28} />
    <TeamLink name={name} onTeamClick={onTeamClick} />
  </Stack>
);

const Overview = ({
  season,
  onTeamClick,
}: {
  season: HistorySeason;
  onTeamClick: (name: string) => void;
}) => (
  <Box
    role="tabpanel"
    aria-label="Season overview"
    sx={{ flex: 1, minHeight: 0, overflow: 'auto', pb: 1 }}
  >
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1.5fr)' },
        gap: 1.5,
      }}
    >
      <Stack spacing={1.5}>
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            National Champion
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5 }}>
            <TeamLogo name={season.championship.champion.name} size={48} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <TeamLink name={season.championship.champion.name} onTeamClick={onTeamClick} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {season.championship.champion.record} · {season.championship.champion.conference}
              </Typography>
            </Box>
            <Typography variant="h4">{season.championship.championScore}</Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1.5 }}>
            <TeamLogo name={season.championship.runnerUp.name} size={36} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <TeamLink name={season.championship.runnerUp.name} onTeamClick={onTeamClick} />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                National runner-up
              </Typography>
            </Box>
            <Typography variant="h5">{season.championship.runnerUpScore}</Typography>
          </Stack>
          <Button
            component={RouterLink}
            to={`/game/${season.championship.gameId}`}
            size="small"
            sx={{ mt: 1.5, px: 0 }}
          >
            View championship game
          </Button>
        </Paper>

        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            Your Season
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <TeamButton name={season.userTeam.name} onTeamClick={onTeamClick} />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
            <Typography variant="h5">{season.userTeam.record}</Typography>
            {season.userTeam.ranking > 0 && (
              <Chip label={`Final #${season.userTeam.ranking}`} size="small" variant="outlined" />
            )}
          </Stack>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.25 }}>
            {season.userTeam.accomplishments.length ? season.userTeam.accomplishments.map(item => (
              <Chip key={`${item.type}-${item.label}`} label={item.label} size="small" />
            )) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No postseason accomplishments recorded.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper component="section" variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography component="h2" variant="h6">Conference Champions</Typography>
          </Box>
          <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
            {season.conferenceChampions.map(entry => (
              <Box
                key={entry.conferenceName}
                sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}
              >
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {entry.conferenceName}
                  </Typography>
                  <TeamButton name={entry.team.name} onTeamClick={onTeamClick} />
                </Box>
                <Button component={RouterLink} to={`/game/${entry.championshipGameId}`} size="small">
                  Game
                </Button>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Stack>

      <Paper component="section" variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography component="h2" variant="h6">Final Top 25</Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" aria-label="Final Top 25" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr" sx={{ bgcolor: 'background.default' }}>
                {['Rank', 'Team', 'Record', 'Conference', 'Rating'].map(label => (
                  <Box
                    component="th"
                    key={label}
                    sx={{ p: 1.25, textAlign: label === 'Rating' ? 'right' : 'left', color: 'text.secondary' }}
                  >
                    {label}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {season.finalRankings.map(team => (
                <Box component="tr" key={team.id} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  <Box component="td" sx={{ p: 1.25, fontWeight: 700 }}>#{team.ranking}</Box>
                  <Box component="td" sx={{ p: 1.25 }}><TeamButton name={team.name} onTeamClick={onTeamClick} /></Box>
                  <Box component="td" sx={{ p: 1.25, whiteSpace: 'nowrap' }}>{team.record}</Box>
                  <Box component="td" sx={{ p: 1.25 }}>{team.conference}</Box>
                  <Box component="td" sx={{ p: 1.25, textAlign: 'right' }}>{team.rating}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  </Box>
);

const LeagueHistory = () => {
  const { year: yearParam } = useParams<{ year?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedYear = yearParam === undefined ? undefined : Number(yearParam);
  const requestedYear = parsedYear === undefined || Number.isInteger(parsedYear)
    ? parsedYear
    : Number.NaN;
  const [selectedTeam, setSelectedTeam] = useState('');
  const tab = getSelectedTab(searchParams.get('tab'));
  const { data, loading, error } = useDomainData<LeagueHistoryPageData>({
    fetcher: () => loadLeagueHistory(requestedYear),
    deps: [yearParam],
  });

  useEffect(() => {
    document.title = data?.season ? `${data.season.year} League History` : 'League History';
    return () => { document.title = 'College Football'; };
  }, [data?.season]);

  const openTeam = (name: string) => setSelectedTeam(name);
  const selectTab = (value: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'overview') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next);
  };

  const selectSeason = (year: number) => {
    const search = searchParams.toString();
    navigate({
      pathname: getLeagueHistoryPath(year),
      search: search ? `?${search}` : '',
    });
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
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: { lg: 1 }, minHeight: { lg: 0 } }}>
            <Stack
              component="header"
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, flexShrink: 0 }}
            >
              <Box>
                <Typography component="h1" variant="h4">League History</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Completed dynasty seasons
                </Typography>
              </Box>
              {data.years.length > 0 && data.season && (
                <TextField
                  select
                  size="small"
                  label="Season"
                  value={data.season.year}
                  onChange={event => selectSeason(Number(event.target.value))}
                  sx={{ minWidth: 120 }}
                >
                  {data.years.map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                </TextField>
              )}
            </Stack>

            {data.season ? (
              <>
                <Tabs
                  value={tab}
                  onChange={(_, value: TabId) => selectTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  aria-label="League history sections"
                  sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 1.25, flexShrink: 0 }}
                >
                  <Tab value="overview" label="Overview" />
                  <Tab value="playoff" label="Playoff" />
                  <Tab value="bowls" label="Bowls" />
                  <Tab value="awards" label="Awards" />
                </Tabs>
                {tab === 'overview' && <Overview season={data.season} onTeamClick={openTeam} />}
                {tab === 'playoff' && (
                  <PostseasonBracketView
                    bracket={data.season.playoff.bracket}
                    format={data.season.playoff.teams as PostseasonFormat}
                    hasTeams
                    onGameClick={gameId => navigate(`/game/${gameId}`)}
                    onTeamClick={openTeam}
                  />
                )}
                {tab === 'bowls' && (
                  <PostseasonBowlView
                    games={data.season.bowls}
                    showingProjections={false}
                    onGameClick={gameId => navigate(`/game/${gameId}`)}
                    onTeamClick={openTeam}
                  />
                )}
                {tab === 'awards' && (
                  <Box
                    role="tabpanel"
                    aria-label="Award winners"
                    sx={{ display: 'flex', flex: 1, minHeight: 0 }}
                  >
                    <AwardsBoard
                      awards={data.season.awards}
                      mode="final"
                      onTeamClick={openTeam}
                      emptyTitle="No award winners archived"
                      emptyDescription="This season did not include finalized individual awards."
                    />
                  </Box>
                )}
              </>
            ) : (
              <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
                <Typography variant="h6">No completed seasons in League History</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                  A season enters History after you advance out of Season Summary.
                </Typography>
              </Paper>
            )}
          </Box>
          <TeamInfoModal
            teamName={selectedTeam}
            open={Boolean(selectedTeam)}
            onClose={() => setSelectedTeam('')}
            statsYear={data.season?.year}
          />
        </>
      )}
    </PageLayout>
  );
};

export default LeagueHistory;
