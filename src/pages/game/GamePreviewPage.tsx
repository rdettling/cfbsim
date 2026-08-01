import { useState } from 'react';
import { Box, Grid } from '@mui/material';
import GameMatchupHeader from '../../components/game/GameMatchupHeader';
import { TeamInfoModal } from '../../components/team/TeamInfoModal';
import {
  resolveHomeAway,
  resolveTeamSide,
} from '../../domain/utils/gameDisplay';
import type { GamePageData } from '../../types/pages';
import { OddsSnapshot } from './game-preview/OddsSnapshot';
import { RecentFormPanel } from './game-preview/RecentFormPanel';
import { TeamStatComparison } from './game-preview/TeamStatComparison';
import { TopStartersPanel } from './game-preview/TopStartersPanel';
import { DynastyContextPanel } from './game-preview/DynastyContextPanel';

type GamePreviewPageProps = {
  data: GamePageData;
};

const GamePreviewPage = ({ data }: GamePreviewPageProps) => {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { game, preview } = data;
  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const awayPreview =
    away.id === game.teamA.id ? preview.teamA : preview.teamB;
  const homePreview =
    home.id === game.teamA.id ? preview.teamA : preview.teamB;

  const handleTeamClick = (teamName: string) => {
    setSelectedTeam(teamName);
    setModalOpen(true);
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: { lg: 1 },
          minHeight: { lg: 0 },
          gap: 1.5,
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

        <Box
          component="section"
          aria-label="Game preview details"
          sx={{
            flex: { lg: 1 },
            minHeight: { lg: 0 },
            overflowY: { lg: 'auto' },
            overflowX: 'hidden',
            pr: { lg: 0.5 },
          }}
        >
          <Grid container spacing={1.5}>
            {data.dynastyContext && (
              <Grid size={{ xs: 12 }}>
                <DynastyContextPanel context={data.dynastyContext} />
              </Grid>
            )}
            <Grid size={{ xs: 12, md: 8 }}>
              <TeamStatComparison
                awayTeam={away}
                homeTeam={home}
                awayPreview={awayPreview}
                homePreview={homePreview}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <OddsSnapshot
                awayTeam={away}
                homeTeam={home}
                awaySide={awaySide}
                homeSide={homeSide}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TopStartersPanel
                awayTeam={away}
                homeTeam={home}
                awayStarters={awayPreview.topStarters}
                homeStarters={homePreview.topStarters}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <RecentFormPanel
                awayTeam={away}
                homeTeam={home}
                awayGames={awayPreview.lastFiveGames}
                homeGames={homePreview.lastFiveGames}
              />
            </Grid>
          </Grid>
        </Box>
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
