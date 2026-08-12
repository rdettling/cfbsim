import { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import GameMatchupHeader from '../../components/game/GameMatchupHeader';
import { TeamInfoModal } from '../../components/team/TeamInfoModal';
import { resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';
import type { GamePageData } from '../../types/pages';
import { RecentFormPanel } from './game-preview/RecentFormPanel';
import { TeamStatComparison } from './game-preview/TeamStatComparison';
import { TopStartersPanel } from './game-preview/TopStartersPanel';
import { GameContextPanel } from './game-shared/GameContextPanel';
import { GamePanel, GameTabbedPanel, type GameTab } from './game-shared/GamePanel';
import { PreviousMatchupsPanel } from './game-shared/PreviousMatchupsPanel';

type PreviewMobileTab = 'matchup' | 'starters' | 'form';

type GamePreviewPageProps = {
  data: GamePageData;
};

const MOBILE_TABS: Array<GameTab<PreviewMobileTab>> = [
  { value: 'matchup', label: 'Matchup' },
  { value: 'starters', label: 'Top Starters' },
  { value: 'form', label: 'Recent Form' },
];

const GamePreviewPage = ({ data }: GamePreviewPageProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileTab, setMobileTab] = useState<PreviewMobileTab>('matchup');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { game, preview } = data;
  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const awayPreview = away.id === game.teamA.id ? preview.teamA : preview.teamB;
  const homePreview = home.id === game.teamA.id ? preview.teamA : preview.teamB;

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  const context = (
    <GameContextPanel
      awayTeam={away}
      homeTeam={home}
      awaySide={awaySide}
      homeSide={homeSide}
      completed={false}
    />
  );

  const renderMatchup = (embedded = false) => (
    <TeamStatComparison
      awayTeam={away}
      homeTeam={home}
      awayPreview={awayPreview}
      homePreview={homePreview}
      embedded={embedded}
    />
  );

  const starters = (
    <TopStartersPanel
      awayTeam={away}
      homeTeam={home}
      awayStarters={awayPreview.topStarters}
      homeStarters={homePreview.topStarters}
    />
  );

  const form = (
    <RecentFormPanel
      awayTeam={away}
      homeTeam={home}
      awayGames={awayPreview.lastFiveGames}
      homeGames={homePreview.lastFiveGames}
    />
  );

  const previousMatchups = (
    <PreviousMatchupsPanel
      teamA={game.teamA}
      teamB={game.teamB}
      awayTeamId={away.id}
      matchups={data.previousMatchups.rows}
      series={data.previousMatchups.series}
    />
  );

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: { lg: 1 },
          minHeight: { lg: 0 },
          gap: 1.25,
          overflow: { lg: 'hidden' },
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <GameMatchupHeader
            game={game}
            away={{ team: away, rank: awaySide.rank }}
            home={{ team: home, rank: homeSide.rank }}
            neutral={neutral}
            mode="preview"
            onTeamClick={handleTeamClick}
          />
        </Box>

        {isDesktop ? (
          <Box
            component="section"
            aria-label="Game preview details"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 420px)',
              gap: 1.25,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: 1.25,
                minHeight: 0,
              }}
            >
              {renderMatchup()}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1.25,
                  minHeight: 0,
                }}
              >
                <GamePanel title="Top Starters" ariaLabel="Top starters" scrollable>
                  {starters}
                </GamePanel>
                <GamePanel title="Recent Form" ariaLabel="Recent form" scrollable>
                  {form}
                </GamePanel>
              </Box>
            </Box>
            <Box
              component="aside"
              sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}
            >
              <Box sx={{ flexShrink: 0 }}>{context}</Box>
              {data.previousMatchups.rows.length > 0 && (
                <Box sx={{ flex: 1, minHeight: 0 }}>{previousMatchups}</Box>
              )}
            </Box>
          </Box>
        ) : (
          <>
            {context}
            {data.previousMatchups.rows.length > 0 && previousMatchups}
            <GameTabbedPanel
              tabs={MOBILE_TABS}
              value={mobileTab}
              onChange={setMobileTab}
              ariaLabel="Game preview sections"
              scrollable={false}
            >
              {mobileTab === 'matchup'
                ? renderMatchup(true)
                : mobileTab === 'starters'
                  ? starters
                  : form}
            </GameTabbedPanel>
          </>
        )}
      </Box>

      <TeamInfoModal
        teamName={selectedTeam}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export default GamePreviewPage;
