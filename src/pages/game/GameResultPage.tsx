import { useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import DriveSummary from '../../components/game/DriveSummary';
import GameMatchupHeader from '../../components/game/GameMatchupHeader';
import { TeamInfoModal } from '../../components/team/TeamInfoModal';
import {
  resolveHomeAway,
  resolveTeamSide,
} from '../../domain/utils/gameDisplay';
import { buildSimMatchup } from '../../domain/utils/simMatchup';
import type { GamePageData } from '../../types/pages';
import { GamePlayerBoxScore } from './game-result/GamePlayerBoxScore';
import { GameTeamComparison } from './game-result/GameTeamComparison';

type ResultTab = 'drives' | 'team-stats' | 'box-score';

type GameResultPageProps = {
  data: GamePageData;
};

const RESULT_TABS: Array<{ value: ResultTab; label: string }> = [
  { value: 'drives', label: 'Drives' },
  { value: 'team-stats', label: 'Team Stats' },
  { value: 'box-score', label: 'Box Score' },
];

const GameResultPage = ({ data }: GameResultPageProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [activeTab, setActiveTab] = useState<ResultTab>('drives');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { game, drives, resultSummary } = data;
  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const matchup = buildSimMatchup(
    game,
    { scoreA: game.scoreA, scoreB: game.scoreB },
    false,
    0
  );
  const awaySummary = resultSummary
    ? away.id === game.teamA.id
      ? resultSummary.teamA
      : resultSummary.teamB
    : null;
  const homeSummary = resultSummary
    ? home.id === game.teamA.id
      ? resultSummary.teamA
      : resultSummary.teamB
    : null;
  const awayBoxScore = resultSummary
    ? away.id === game.teamA.id
      ? resultSummary.boxScore.teamA
      : resultSummary.boxScore.teamB
    : null;
  const homeBoxScore = resultSummary
    ? home.id === game.teamA.id
      ? resultSummary.boxScore.teamA
      : resultSummary.boxScore.teamB
    : null;

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  const renderPanel = (panel: ResultTab) => {
    if (panel === 'drives') {
      return (
        <DriveSummary
          drives={drives}
          variant="page"
          matchup={matchup}
        />
      );
    }

    if (panel === 'team-stats') {
      return (
        <GameTeamComparison
          awayTeam={away}
          homeTeam={home}
          awaySummary={awaySummary}
          homeSummary={homeSummary}
        />
      );
    }

    return (
      <GamePlayerBoxScore
        awayTeam={away}
        homeTeam={home}
        awayBoxScore={awayBoxScore}
        homeBoxScore={homeBoxScore}
      />
    );
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: { lg: 1 },
          minHeight: { lg: 0 },
          gap: 1.25,
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <GameMatchupHeader
            game={game}
            home={{ team: home, rank: homeSide.rank }}
            away={{ team: away, rank: awaySide.rank }}
            neutral={neutral}
            mode="result"
            awayScore={awaySide.score}
            homeScore={homeSide.score}
            overtime={game.overtime}
            story={game.story}
            onTeamClick={handleTeamClick}
          />
        </Box>

        {!resultSummary && drives.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6">Detailed game data is no longer available</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              The final score and dynasty memory are preserved, but play-by-play and
              player logs are retained for user-program games and major postseason games.
            </Typography>
          </Paper>
        ) : isDesktop ? (
          <Box
            component="section"
            aria-label="Game result details"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 3fr) minmax(0, 4fr)',
              gap: 1.25,
              flex: 1,
              minHeight: 0,
            }}
          >
            {renderPanel('drives')}
            {renderPanel('team-stats')}
            {renderPanel('box-score')}
          </Box>
        ) : (
          <Box component="section" aria-label="Game result details">
            <Tabs
              value={activeTab}
              onChange={(_, value: ResultTab) => setActiveTab(value)}
              variant="fullWidth"
              selectionFollowsFocus
              aria-label="Game result sections"
              sx={{
                minHeight: 42,
                mb: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              {RESULT_TABS.map((tab) => (
                <Tab
                  key={tab.value}
                  id={`game-result-tab-${tab.value}`}
                  aria-controls={`game-result-panel-${tab.value}`}
                  value={tab.value}
                  label={tab.label}
                  sx={{ minHeight: 42 }}
                />
              ))}
            </Tabs>
            <Box
              role="tabpanel"
              id={`game-result-panel-${activeTab}`}
              aria-labelledby={`game-result-tab-${activeTab}`}
              sx={{ height: 'clamp(420px, 65vh, 640px)', minHeight: 0 }}
            >
              {renderPanel(activeTab)}
            </Box>
          </Box>
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

export default GameResultPage;
