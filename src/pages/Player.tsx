import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadPlayer } from '../domain/league';
import type { PlayerPageData } from '../types/pages';
import { PlayerCareerDesktopTable } from './player-detail/PlayerCareerDesktopTable';
import { PlayerCareerMobileList } from './player-detail/PlayerCareerMobileList';
import { PlayerGameLogsDesktopTable } from './player-detail/PlayerGameLogsDesktopTable';
import { PlayerGameLogsMobileList } from './player-detail/PlayerGameLogsMobileList';
import { PlayerProfile } from './player-detail/PlayerProfile';
import { PlayerOrigin } from './player-detail/PlayerOrigin';

type PlayerTab = 'career' | 'logs';

const Player = () => {
  const { playerId } = useParams();
  const [activeTab, setActiveTab] = useState<PlayerTab>('career');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading, error } = useDomainData<PlayerPageData>({
    fetcher: () => {
      if (!playerId) throw new Error('No player ID provided');
      return loadPlayer(playerId);
    },
    deps: [playerId],
  });

  const years = useMemo(
    () =>
      data
        ? Array.from(
            new Set(
              [...Object.keys(data.career_stats), ...Object.keys(data.game_logs)].map(Number),
            ),
          ).sort((a, b) => b - a)
        : [],
    [data],
  );
  const seasons = data
    ? years
        .map((year) => ({ year, season: data.career_stats[year] }))
        .filter((entry): entry is { year: number; season: NonNullable<typeof entry.season> } =>
          Boolean(entry.season),
        )
    : [];
  const gameLogs = data && selectedYear ? (data.game_logs[selectedYear] ?? []) : [];

  useEffect(() => {
    setSelectedYear(years[0] ?? null);
  }, [playerId, years[0]]);

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
          <PlayerProfile
            player={data.player}
            awards={data.awards}
            teamColor={data.team.colorPrimary}
            onTeamClick={handleTeamClick}
          />
          <PlayerOrigin origin={data.origin} onTeamClick={handleTeamClick} />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              mb: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, value: PlayerTab) => setActiveTab(value)}
              aria-label="Player statistics"
              sx={{ minHeight: 40 }}
            >
              <Tab value="career" label="Career" sx={{ minHeight: 40 }} />
              <Tab value="logs" label="Game Logs" sx={{ minHeight: 40 }} />
            </Tabs>
            {activeTab === 'logs' && years.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 116, mb: { xs: 1, sm: 0.75 } }}>
                <InputLabel id="player-log-year-label">Year</InputLabel>
                <Select
                  labelId="player-log-year-label"
                  value={selectedYear ?? ''}
                  label="Year"
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {activeTab === 'career' ? (
            seasons.length > 0 ? (
              <>
                <PlayerCareerDesktopTable seasons={seasons} category={data.stat_category} />
                <PlayerCareerMobileList seasons={seasons} category={data.stat_category} />
              </>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6">No career statistics available</Typography>
              </Paper>
            )
          ) : gameLogs.length > 0 ? (
            <>
              {data.gameLogScope === 'retained_postseason_only' && (
                <Paper variant="outlined" sx={{ p: 1.25, mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Career totals are complete. Game-by-game history is limited to retained
                    conference championship and playoff games.
                  </Typography>
                </Paper>
              )}
              <PlayerGameLogsDesktopTable
                logs={gameLogs}
                category={data.stat_category}
                onTeamClick={handleTeamClick}
              />
              <PlayerGameLogsMobileList
                logs={gameLogs}
                category={data.stat_category}
                onTeamClick={handleTeamClick}
              />
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6">No games played this season</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                {data.gameLogScope === 'retained_postseason_only'
                  ? 'Career totals are complete; ordinary historical game detail is not retained.'
                  : 'Game logs will appear after this player records statistics.'}
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

export default Player;
