import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stack } from '@mui/material';
import { PageLayout } from '../components/layout/PageLayout';
import { TeamInfoModal } from '../components/team/TeamInfoModal';
import { useDomainData } from '../domain/hooks';
import { loadPlayer } from '../domain/league/loaders/team/loadPlayer';
import type { PlayerPageData } from '../types/pages';
import { PlayerStatsWorkspace, type PlayerTab } from './player-detail/PlayerStatsWorkspace';
import { PlayerSummary } from './player-detail/PlayerSummary';

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
  const latestYear = years[0] ?? null;
  const gameLogs = data && selectedYear ? (data.game_logs[selectedYear] ?? []) : [];

  useEffect(() => {
    setSelectedYear(latestYear);
  }, [playerId, latestYear]);

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
            spacing={1.25}
            sx={{
              height: { lg: '100%' },
              minHeight: { lg: 0 },
              overflow: { lg: 'hidden' },
            }}
          >
            <PlayerSummary
              player={data.player}
              awards={data.awards}
              origin={data.origin}
              teamColor={data.team.colorPrimary}
              onTeamClick={handleTeamClick}
            />
            <PlayerStatsWorkspace
              activeTab={activeTab}
              onTabChange={setActiveTab}
              years={years}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              seasons={seasons}
              gameLogs={gameLogs}
              category={data.stat_category}
              gameLogScope={data.gameLogScope}
              onTeamClick={handleTeamClick}
            />
          </Stack>
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
