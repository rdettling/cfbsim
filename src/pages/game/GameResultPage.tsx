import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { TeamInfoModal } from '../../components/team/TeamComponents';
import DriveSummary from '../../components/game/DriveSummary';
import GameHeader from '../../components/game/GameHeader';
import TeamStatsCard from '../../components/game/TeamStatsCard';
import PlayerBoxScoreCard from '../../components/game/PlayerBoxScoreCard';
import type { GameResultProps } from '../../types/components';
import { resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';
import { buildSimMatchup } from '../../domain/utils/simMatchup';

const CARD_SX = { height: '100%', border: '1px solid', borderColor: 'divider' } as const;
const CARD_CONTENT_SX = { p: 1.5 } as const;
const RESULT_PANEL_HEIGHT = 500;

const GameResultPage = ({ data }: GameResultProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const { game, drives = [], resultSummary } = data;
  const { home, away, neutral } = resolveHomeAway(game);
  const matchup = buildSimMatchup(
    game,
    { scoreA: game.scoreA ?? 0, scoreB: game.scoreB ?? 0 },
    false,
    0
  );
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const awaySummary = resultSummary
    ? (away.id === game.teamA.id ? resultSummary.teamA : resultSummary.teamB)
    : null;
  const homeSummary = resultSummary
    ? (home.id === game.teamA.id ? resultSummary.teamA : resultSummary.teamB)
    : null;

  return (
    <Container maxWidth={false} sx={{ pt: 0.75, pb: 1.25, px: { xs: 1.5, md: 3 } }}>
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        <GameHeader
          game={game}
          home={home}
          away={away}
          neutral={neutral}
          mode="result"
          awayScore={awaySide.score ?? 0}
          homeScore={homeSide.score ?? 0}
          resultStatus={game.overtime && game.overtime > 0 ? `FINAL • ${game.overtime}OT` : 'FINAL'}
          headlineSubtitle={game.headline_subtitle ?? null}
          homeSide={homeSide}
          awaySide={awaySide}
          onTeamClick={handleTeamClick}
        />

        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, md: 4 }}>
            {drives.length > 0 ? (
              <DriveSummary drives={drives} variant="page" matchup={matchup} panelHeight={RESULT_PANEL_HEIGHT} />
            ) : (
              <Card elevation={1} sx={CARD_SX}>
                <CardContent sx={CARD_CONTENT_SX}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Drive Summary
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Drive details are not available for this game.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TeamStatsCard
              awaySummary={awaySummary}
              homeSummary={homeSummary}
              hasSummary={Boolean(resultSummary)}
              awayTeamName={away.name}
              homeTeamName={home.name}
              panelHeight={RESULT_PANEL_HEIGHT}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <PlayerBoxScoreCard
              resultSummary={resultSummary}
              game={game}
              away={{ id: away.id, name: away.name }}
              home={{ id: home.id, name: home.name }}
              panelHeight={RESULT_PANEL_HEIGHT}
            />
          </Grid>
        </Grid>
      </Box>

      <TeamInfoModal
        teamName={selectedTeam}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Container>
  );
};

export default GameResultPage;
