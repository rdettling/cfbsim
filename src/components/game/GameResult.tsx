import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Divider,
  Stack,
  Chip,
  Tab,
  Tabs,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamInfoModal } from '../team/TeamComponents';
import DriveSummary from './DriveSummary';
import GameHeader from './GameHeader';
import type { GameResultProps } from '../../types/components';
import { resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';
import { buildSimMatchup } from '../../domain/utils/simMatchup';

const CARD_SX = { height: '100%', border: '1px solid', borderColor: 'divider' } as const;
const CARD_CONTENT_SX = { p: 1.5 } as const;
const BOX_SCORE_PANEL_MAX_HEIGHT = 540;

const GameResult = ({ data }: GameResultProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [boxScoreTeam, setBoxScoreTeam] = useState<'away' | 'home'>('away');

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

  const statRows = [
    { label: 'Points', away: awaySummary?.points, home: homeSummary?.points },
    { label: 'Total Yards', away: awaySummary?.totalYards, home: homeSummary?.totalYards },
    { label: 'Pass Yards', away: awaySummary?.passYards, home: homeSummary?.passYards },
    { label: 'Rush Yards', away: awaySummary?.rushYards, home: homeSummary?.rushYards },
    { label: 'First Downs', away: awaySummary?.firstDowns, home: homeSummary?.firstDowns },
    { label: 'Turnovers', away: awaySummary?.turnovers, home: homeSummary?.turnovers },
    { label: 'Plays', away: awaySummary?.plays, home: homeSummary?.plays },
    {
      label: '3rd Down',
      away: awaySummary ? `${awaySummary.thirdDown.made}/${awaySummary.thirdDown.attempts} (${awaySummary.thirdDown.pct}%)` : '--',
      home: homeSummary ? `${homeSummary.thirdDown.made}/${homeSummary.thirdDown.attempts} (${homeSummary.thirdDown.pct}%)` : '--',
    },
  ];

  const boxScoreSections = [
    { label: 'Passing', key: 'passing' as const },
    { label: 'Rushing', key: 'rushing' as const },
    { label: 'Receiving', key: 'receiving' as const },
    { label: 'Defensive', key: 'defense' as const },
    { label: 'Kicking', key: 'kicking' as const },
  ];
  const selectedBoxScore =
    !resultSummary
      ? null
      : boxScoreTeam === 'away'
        ? away.id === game.teamA.id
          ? resultSummary.boxScore.teamA
          : resultSummary.boxScore.teamB
        : home.id === game.teamA.id
          ? resultSummary.boxScore.teamA
          : resultSummary.boxScore.teamB;

  return (
    <Container maxWidth={false} sx={{ py: 1.5, px: { xs: 1.5, md: 3 } }}>
      <Box sx={{ display: 'grid', gap: 1.5 }}>
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

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            {drives.length > 0 ? (
              <DriveSummary drives={drives} variant="page" matchup={matchup} />
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
            <Card elevation={1} sx={CARD_SX}>
              <CardContent sx={CARD_CONTENT_SX}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.7 }}>
                  Team Box Score
                </Typography>
                {!resultSummary ? (
                  <Typography variant="body2" color="text.secondary">
                    Team stats are not available.
                  </Typography>
                ) : (
                  <Stack spacing={0.45}>
                    {statRows.map((row, index) => (
                      <Box key={row.label}>
                        <Grid container alignItems="center">
                          <Grid size={{ xs: 3.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {row.away ?? '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 5 }}>
                            <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 600 }}>
                              {row.label}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 3.5 }}>
                            <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 700 }}>
                              {row.home ?? '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                        {index !== statRows.length - 1 && <Divider sx={{ mt: 0.4 }} />}
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={1} sx={CARD_SX}>
              <CardContent
                sx={{
                  ...CARD_CONTENT_SX,
                  height: BOX_SCORE_PANEL_MAX_HEIGHT,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.7 }}>
                  Player Box Score
                </Typography>
                {!resultSummary ? (
                  <Typography variant="body2" color="text.secondary">
                    Player stats are not available.
                  </Typography>
                ) : (
                  <Stack
                    spacing={0.9}
                    sx={{
                      minHeight: 0,
                      overflowY: 'auto',
                      pr: 0.4,
                    }}
                  >
                    <Tabs
                      value={boxScoreTeam}
                      onChange={(_, value: 'away' | 'home') => setBoxScoreTeam(value)}
                      variant="fullWidth"
                      sx={{ minHeight: 34, flexShrink: 0 }}
                    >
                      <Tab
                        value="away"
                        label={away.name}
                        sx={{ minHeight: 34, textTransform: 'none', fontWeight: 700 }}
                      />
                      <Tab
                        value="home"
                        label={home.name}
                        sx={{ minHeight: 34, textTransform: 'none', fontWeight: 700 }}
                      />
                    </Tabs>
                    {boxScoreSections.map((section, sectionIndex) => (
                      <Box key={section.key}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {section.label}
                        </Typography>
                        {!selectedBoxScore || selectedBoxScore[section.key].length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            No entries
                          </Typography>
                        ) : (
                          <Stack spacing={0.35} sx={{ mt: 0.25 }}>
                            {selectedBoxScore[section.key].slice(0, 5).map(entry => (
                              <Box
                                key={`${section.key}:${entry.playerId}`}
                                sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    component={RouterLink}
                                    to={`/players/${entry.playerId}`}
                                    sx={{
                                      color: 'text.primary',
                                      textDecoration: 'none',
                                      fontWeight: 600,
                                      '&:hover': { textDecoration: 'underline' },
                                    }}
                                    noWrap
                                  >
                                    {entry.name}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Chip size="small" label={entry.pos} sx={{ height: 18, fontSize: '0.65rem' }} />
                                    <Typography variant="caption" color="text.secondary">
                                      {entry.team}
                                    </Typography>
                                  </Stack>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textAlign: 'right' }}>
                                  {entry.statLine}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                        {sectionIndex !== boxScoreSections.length - 1 && (
                          <Divider sx={{ mt: 0.65 }} />
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
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

export default GameResult;
