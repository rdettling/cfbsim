import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Card,
  CardContent,
  Chip,
  Stack,
  LinearProgress,
  Divider,
} from '@mui/material';
import { TeamInfoModal, TeamLogo, TeamLink } from '../team/TeamComponents';
import type { GamePreviewProps } from '../../types/components';
import { resolveHomeAway, resolveTeamSide, formatMatchup } from '../../domain/utils/gameDisplay';

const STAT_ROWS = [
  { key: 'points_per_game', label: 'Points/Game' },
  { key: 'yards_per_game', label: 'Yards/Game' },
  { key: 'pass_yards_per_game', label: 'Pass Yards/Game' },
  { key: 'pass_tds_per_game', label: 'Pass TD/Game' },
  { key: 'rush_yards_per_game', label: 'Rush Yards/Game' },
  { key: 'turnovers_per_game', label: 'Turnovers/Game' },
] as const;

const GamePreview = ({ data }: GamePreviewProps) => {
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
  const venueText = neutral ? 'Neutral Site' : `${home.stadium} • ${home.city}, ${home.state}`;
  const spreadText = awaySide.spread
    ? `${away.abbreviation || away.name} ${awaySide.spread}`
    : `${home.abbreviation || home.name} ${homeSide.spread ?? ''}`.trim();

  const formatWinProb = (value: number) => `${Math.round(value * 100)}%`;
  const favoriteName = awayWinProb >= homeWinProb ? away.name : home.name;
  const offenseEdgeAway = away.offense - home.defense;
  const offenseEdgeHome = home.offense - away.defense;
  const pointsEdgeAway = awayPreview.stats.points_per_game - homePreview.stats.points_per_game;
  const turnoverEdgeAway = homePreview.stats.turnovers_per_game - awayPreview.stats.turnovers_per_game;

  const matchupNotes = [
    offenseEdgeAway >= offenseEdgeHome
      ? `${away.name} offense edge ${offenseEdgeAway >= 0 ? '+' : ''}${offenseEdgeAway.toFixed(1)}`
      : `${home.name} offense edge ${offenseEdgeHome >= 0 ? '+' : ''}${offenseEdgeHome.toFixed(1)}`,
    pointsEdgeAway >= 0
      ? `${away.name} scores ${pointsEdgeAway.toFixed(1)} more PPG`
      : `${home.name} scores ${Math.abs(pointsEdgeAway).toFixed(1)} more PPG`,
    turnoverEdgeAway >= 0
      ? `${away.name} protects the ball better (${turnoverEdgeAway.toFixed(1)} TO/G edge)`
      : `${home.name} protects the ball better (${Math.abs(turnoverEdgeAway).toFixed(1)} TO/G edge)`,
  ];

  const renderTeamHeader = (
    team: typeof away,
    side: typeof awaySide,
    align: 'left' | 'right'
  ) => (
    <Stack direction={align === 'left' ? 'row' : 'row-reverse'} spacing={1.5} alignItems="center">
      <TeamLogo name={team.name} size={64} />
      <Box sx={{ textAlign: align }}>
        <Stack
          direction="row"
          spacing={0.8}
          alignItems="center"
          justifyContent={align === 'left' ? 'flex-start' : 'flex-end'}
        >
          {side.rank > 0 && <Chip label={`#${side.rank}`} size="small" color="primary" />}
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1 }}>
            <TeamLink name={team.name} onTeamClick={handleTeamClick} />
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {team.record} • {team.conference}
        </Typography>
      </Box>
    </Stack>
  );

  const renderStatsCard = (
    team: typeof away,
    side: typeof awaySide,
    sidePreview: typeof awayPreview,
    align: 'left' | 'right'
  ) => (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ mb: 1.25 }}>
          {renderTeamHeader(team, side, align)}
        </Box>
        <Stack spacing={0.6}>
          {STAT_ROWS.map(row => (
            <Box
              key={row.key}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Typography variant="caption" color="text.secondary">
                {row.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {sidePreview.stats[row.key].toFixed(1)} <Typography component="span" variant="caption" color="text.secondary">(#{sidePreview.ranks[row.key]})</Typography>
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );

  const renderPlayersCard = (
    team: typeof away,
    sidePreview: typeof awayPreview
  ) => (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.8 }}>
          {team.name} Players
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Top 5 Starters
        </Typography>
        <Stack spacing={0.35} sx={{ mb: 1.2, mt: 0.45 }}>
          {sidePreview.topStarters.map(player => (
            <Box key={player.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                {player.pos} {player.first} {player.last}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {player.rating}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Divider sx={{ mb: 0.8 }} />
        <Typography variant="caption" color="text.secondary">
          Key Players
        </Typography>
        <Stack spacing={0.35} sx={{ mt: 0.45 }}>
          {sidePreview.keyPlayers.map(player => (
            <Box key={player.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                {player.pos} {player.first} {player.last}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                OVR {player.rating}{player.impact > 0 ? ` • IMP ${player.impact.toFixed(1)}` : ''}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 1.5 }}>
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        <Paper elevation={2} sx={{ p: 1.5 }}>
          <Grid container alignItems="center" spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              {renderTeamHeader(away, awaySide, 'left')}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1, color: 'primary.main' }}>
                  {formatMatchup(home.name, away.name, neutral)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Week {game.weekPlayed} • {game.year} • {venueText}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.4 }}>
                  Spread {spreadText} • ML {away.abbreviation || away.name} {awaySide.moneyline || '--'} / {home.abbreviation || home.name} {homeSide.moneyline || '--'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              {renderTeamHeader(home, homeSide, 'right')}
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, md: 4 }}>
            {renderStatsCard(away, awaySide, awayPreview, 'left')}
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2} sx={{ height: '100%' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Game Lens
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Favorite: {favoriteName} ({formatWinProb(Math.max(awayWinProb, homeWinProb))})
                </Typography>

                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {away.name} {formatWinProb(awayWinProb)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {home.name} {formatWinProb(homeWinProb)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.round(awayWinProb * 100)}
                  sx={{
                    height: 10,
                    borderRadius: 99,
                    backgroundColor: 'grey.200',
                    '& .MuiLinearProgress-bar': { backgroundColor: 'primary.main' },
                  }}
                />

                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Key Matchups
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.4 }}>
                  {matchupNotes.map(note => (
                    <Typography key={note} variant="body2">
                      {note}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            {renderStatsCard(home, homeSide, homePreview, 'right')}
          </Grid>
        </Grid>

        <Grid container spacing={1.25}>
          <Grid size={{ xs: 12, md: 6 }}>
            {renderPlayersCard(away, awayPreview)}
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            {renderPlayersCard(home, homePreview)}
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

export default GamePreview;
