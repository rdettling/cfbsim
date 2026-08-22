import { useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import DriveSummary from '../../components/game/DriveSummary';
import GameMatchupHeader from '../../components/game/GameMatchupHeader';
import { TeamInfoModal } from '../../components/team/TeamInfoModal';
import { resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';
import { buildSimMatchup } from '../../domain/utils/simMatchup';
import type { GamePageData } from '../../types/pages';
import { GamePlayerBoxScore } from './game-result/GamePlayerBoxScore';
import { GameRecap } from './game-result/GameRecap';
import { GameTeamComparison } from './game-result/GameTeamComparison';
import { PreviousMatchupsPanel } from './game-shared/PreviousMatchupsPanel';
import { GameContextPanel } from './game-shared/GameContextPanel';
import { GamePanel, GameTabbedPanel, type GameTab } from './game-shared/GamePanel';

type ResultRailTab = 'recap' | 'team-stats' | 'box-score';
type ResultMobileTab = ResultRailTab | 'drives';

type GameResultPageProps = {
  data: GamePageData;
};

const GameResultPage = ({ data }: GameResultPageProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const { game, drives, resultSummary } = data;
  const defaultTab: ResultRailTab = game.story
    ? 'recap'
    : resultSummary
      ? 'team-stats'
      : 'recap';
  const [railTab, setRailTab] = useState<ResultRailTab>(defaultTab);
  const [mobileTab, setMobileTab] = useState<ResultMobileTab>(defaultTab);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const matchup = buildSimMatchup(
    game,
    { scoreA: game.scoreA, scoreB: game.scoreB },
    false,
    0,
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

  const resultTabs: Array<GameTab<ResultRailTab>> = resultSummary
    ? [
        { value: 'recap', label: 'Recap' },
        { value: 'team-stats', label: 'Team Stats' },
        { value: 'box-score', label: 'Box Score' },
      ]
    : [{ value: 'recap', label: 'Recap' }];
  const mobileTabs: Array<GameTab<ResultMobileTab>> = [
    { value: 'recap', label: 'Recap' },
    { value: 'drives', label: 'Drives' },
    ...(resultSummary
      ? [
          { value: 'team-stats' as const, label: 'Team Stats' },
          { value: 'box-score' as const, label: 'Box Score' },
        ]
      : []),
  ];

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
      completed
    />
  );
  const previousMatchups = (
    <PreviousMatchupsPanel
      teamA={game.teamA}
      teamB={game.teamB}
      matchups={data.previousMatchups.rows}
      series={data.previousMatchups.series}
    />
  );

  const unavailableCopy = (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      Detailed game data is no longer available. The final score and dynasty memory are
      preserved, but play-by-play and player logs are retained only for user-program games and
      major postseason games.
    </Typography>
  );

  const renderDrives = (embedded = false) => {
    if (data.detailUnavailable) {
      return embedded ? (
        unavailableCopy
      ) : (
        <GamePanel title="Drive Summary" ariaLabel="Game detail unavailable">
          {unavailableCopy}
        </GamePanel>
      );
    }
    return <DriveSummary drives={drives} variant="page" matchup={matchup} embedded={embedded} />;
  };

  const renderDetail = (tab: ResultRailTab) => {
    if (tab === 'recap') return <GameRecap story={game.story} />;
    if (tab === 'team-stats') {
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
          overflow: { lg: 'hidden' },
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <GameMatchupHeader
            game={game}
            away={{
              team: away,
              rank: awaySide.rank,
              score: awaySide.score,
              winner: game.winnerId === away.id,
            }}
            home={{
              team: home,
              rank: homeSide.rank,
              score: homeSide.score,
              winner: game.winnerId === home.id,
            }}
            neutral={neutral}
            mode="result"
            overtime={game.overtime}
            onTeamClick={handleTeamClick}
          />
        </Box>

        {isDesktop ? (
          <Box
            component="section"
            aria-label="Game result details"
            sx={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(0, 1.2fr) minmax(320px, 0.95fr) minmax(300px, 0.85fr)',
              gap: 1.25,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {renderDrives()}
            <Box sx={{ minHeight: 0 }}>
              <GameTabbedPanel
                tabs={resultTabs}
                value={railTab}
                onChange={setRailTab}
                ariaLabel="Game result sections"
              >
                {renderDetail(railTab)}
              </GameTabbedPanel>
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
              tabs={mobileTabs}
              value={mobileTab}
              onChange={setMobileTab}
              ariaLabel="Game result sections"
              scrollable={false}
            >
              {mobileTab === 'drives' ? renderDrives(true) : renderDetail(mobileTab)}
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

export default GameResultPage;
