import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  LinearProgress,
  Divider,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamInfoModal, TeamLogo } from '../../components/team/TeamComponents';
import GameHeader from '../../components/game/GameHeader';
import type { GamePreviewProps } from '../../types/components';
import { resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';

const CARD_SX = { height: '100%', border: '1px solid', borderColor: 'divider' } as const;
const CARD_CONTENT_SX = { p: 1.75 } as const;
const SPLIT_COLUMN_SX = {
  borderLeft: { xs: 'none', sm: '1px solid' },
  borderColor: { xs: 'transparent', sm: 'divider' },
  pl: { xs: 0, sm: 1.5 },
} as const;

const STAT_ROWS = [
  { key: 'points_per_game', label: 'Points/Game' },
  { key: 'yards_per_game', label: 'Yards/Game' },
  { key: 'pass_yards_per_game', label: 'Pass Yards/Game' },
  { key: 'pass_tds_per_game', label: 'Pass TD/Game' },
  { key: 'rush_yards_per_game', label: 'Rush Yards/Game' },
  { key: 'turnovers_per_game', label: 'Turnovers/Game' },
] as const;

const formatWinProb = (value: number) => `${Math.round(value * 100)}%`;
const showMetricValue = (value: number, gamesPlayed: number) =>
  gamesPlayed === 0 ? '—' : value.toFixed(1);
const showMetricRank = (rank: number, gamesPlayed: number) =>
  gamesPlayed === 0 ? '—' : `#${rank}`;

const GamePreviewPage = ({ data }: GamePreviewProps) => {
  const { game, preview } = data;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const handleTeamClick = (name: string) => {
    setSelectedTeam(name);
    setModalOpen(true);
  };

  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const awayPreview = away.id === game.teamA.id ? preview.teamA : preview.teamB;
  const homePreview = home.id === game.teamA.id ? preview.teamA : preview.teamB;

  const awayWinProb = typeof awaySide.winProb === 'number' ? awaySide.winProb : 0.5;
  const homeWinProb = typeof homeSide.winProb === 'number' ? homeSide.winProb : 0.5;
  const favoriteName = awayWinProb >= homeWinProb ? away.name : home.name;
  const spreadText = awaySide.spread
    ? `${away.abbreviation || away.name} ${awaySide.spread}`
    : `${home.abbreviation || home.name} ${homeSide.spread ?? ''}`.trim();
  const hasPregameStats = awayPreview.gamesPlayed > 0 && homePreview.gamesPlayed > 0;

  const renderTopStartersColumn = (team: typeof away, sidePreview: typeof awayPreview) => (
    <Box>
      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.6 }}>
        <TeamLogo name={team.name} size={24} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {team.name}
        </Typography>
      </Stack>
      <Stack spacing={0.2}>
        {sidePreview.topStarters.map((player, index) => (
          <Box key={player.id}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 0.8, py: 0.35 }}>
              <Chip
                size="small"
                label={player.pos}
                sx={{
                  height: 20,
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  minWidth: 34,
                }}
              />
              <Typography
                variant="body2"
                noWrap
                sx={{
                  textDecoration: 'none',
                  color: 'text.primary',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
                component={RouterLink}
                to={`/players/${player.id}`}
              >
                {player.first} {player.last}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontWeight: 700,
                  minWidth: 26,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {player.rating}
              </Typography>
            </Box>
            {index !== sidePreview.topStarters.length - 1 && (
              <Divider sx={{ borderColor: 'grey.300' }} />
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );

  const renderLastFiveColumn = (team: typeof away, sidePreview: typeof awayPreview) => (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
        {team.name}
      </Typography>
      {sidePreview.lastFiveGames.length ? (
        <Stack spacing={0.55} sx={{ mt: 0.35 }}>
          {sidePreview.lastFiveGames.map((entry, index) => (
            <Box key={entry.id}>
              <Box
                component={RouterLink}
                to={`/game/${entry.id}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 1,
                  px: 0.6,
                  py: 0.45,
                  borderRadius: 1,
                  color: 'text.primary',
                  textDecoration: 'none',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Stack direction="row" spacing={0.55} alignItems="center">
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: entry.result === 'W' ? 'success.main' : 'error.main',
                      minWidth: 14,
                      textAlign: 'center',
                    }}
                  >
                    {entry.result}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 34 }}>
                    Wk {entry.week}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
                  <TeamLogo name={entry.opponent} size={18} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {entry.location} {entry.opponent}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  {entry.score}
                </Typography>
              </Box>
              {index !== sidePreview.lastFiveGames.length - 1 && (
                <Divider sx={{ mt: 0.45, borderColor: 'grey.300' }} />
              )}
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          No completed games yet.
        </Typography>
      )}
    </Box>
  );

  return (
    <Container maxWidth={false} sx={{ py: 1.75, px: { xs: 1.5, md: 3 } }}>
      <Box sx={{ display: 'grid', gap: 1.75 }}>
        <GameHeader
          game={game}
          home={home}
          away={away}
          neutral={neutral}
          homeSide={homeSide}
          awaySide={awaySide}
          onTeamClick={handleTeamClick}
        />

        <Grid container spacing={1.75}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card elevation={1} sx={CARD_SX}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.8 }}>
                  Team Stat Comparison
                </Typography>
                {!hasPregameStats ? (
                  <Typography variant="body1" color="text.secondary">
                    No prior games yet this season. Team stat comparisons will appear after each team has played.
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    {STAT_ROWS.map((row, index) => (
                      <Box key={row.key}>
                        <Grid container alignItems="center" spacing={0.6}>
                          <Grid size={{ xs: 2.5, md: 2 }}>
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                              {showMetricValue(awayPreview.stats[row.key], awayPreview.gamesPlayed)}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 1.5, md: 1.2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                              {showMetricRank(awayPreview.ranks[row.key], awayPreview.gamesPlayed)}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 4, md: 5.6 }}>
                            <Typography variant="body1" sx={{ textAlign: 'center', fontWeight: 600 }}>
                              {row.label}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 1.5, md: 1.2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right', display: 'block', fontWeight: 600 }}>
                              {showMetricRank(homePreview.ranks[row.key], homePreview.gamesPlayed)}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 2.5, md: 2 }}>
                            <Typography variant="body1" sx={{ textAlign: 'right', fontWeight: 700 }}>
                              {showMetricValue(homePreview.stats[row.key], homePreview.gamesPlayed)}
                            </Typography>
                          </Grid>
                        </Grid>
                        {index !== STAT_ROWS.length - 1 && <Divider sx={{ mt: 0.45, borderColor: 'grey.300' }} />}
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={1} sx={CARD_SX}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.8 }}>
                  Odds Snapshot
                </Typography>
                <Stack spacing={1.1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Spread
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {spreadText}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Moneyline
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {away.abbreviation || away.name} {awaySide.moneyline || '--'} / {home.abbreviation || home.name} {homeSide.moneyline || '--'}
                    </Typography>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {away.name} {formatWinProb(awayWinProb)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {home.name} {formatWinProb(homeWinProb)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.round(awayWinProb * 100)}
                      sx={{
                        mt: 0.25,
                        height: 11,
                        borderRadius: 99,
                        backgroundColor: 'grey.200',
                        '& .MuiLinearProgress-bar': { backgroundColor: 'primary.main' },
                      }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={1.75}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={1} sx={CARD_SX}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.7 }}>
                  Top Starters
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {renderTopStartersColumn(away, awayPreview)}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} sx={SPLIT_COLUMN_SX}>
                    {renderTopStartersColumn(home, homePreview)}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={1} sx={CARD_SX}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.7 }}>
                  Last Five Games
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {renderLastFiveColumn(away, awayPreview)}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} sx={SPLIT_COLUMN_SX}>
                    {renderLastFiveColumn(home, homePreview)}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
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

export default GamePreviewPage;
