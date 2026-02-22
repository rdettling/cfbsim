import { Box, Grid, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo, TeamLink } from '../team/TeamComponents';
import type { GameHeaderProps } from '../../types/components';
import { formatMatchup } from '../../domain/utils/gameDisplay';

const TEAM_LINK_SX = {
  '& .MuiLink-root': {
    textDecoration: 'none',
    color: 'text.primary',
    fontWeight: 800,
    '&:hover': { textDecoration: 'underline' },
  },
} as const;

const renderTeamHeader = (
  team: GameHeaderProps['away'],
  side: GameHeaderProps['awaySide'],
  align: 'left' | 'right',
  onTeamClick: GameHeaderProps['onTeamClick'],
  mode: NonNullable<GameHeaderProps['mode']>
) => {
  const teamName = <TeamLink name={team.name} onTeamClick={onTeamClick} />;
  const isLeft = align === 'left';
  const logoSize = mode === 'result' ? 28 : 36;
  const rankVariant = mode === 'result' ? 'h5' : 'h4';
  const nameVariant = mode === 'result' ? 'h3' : 'h4';
  const ovrVariant = mode === 'result' ? 'h6' : 'body1';
  const recordVariant = mode === 'result' ? 'h5' : 'h6';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isLeft ? 'row' : 'row-reverse',
        gap: 0.9,
        alignItems: 'start',
      }}
    >
      <Box sx={{ lineHeight: 0, mt: 0.1 }}>
        <TeamLogo name={team.name} size={logoSize} />
      </Box>
      <Box sx={{ minWidth: 0, textAlign: align }}>
        <Stack
          direction="row"
          spacing={0.65}
          alignItems="center"
          justifyContent={isLeft ? 'flex-start' : 'flex-end'}
        >
          <Typography variant={rankVariant} sx={{ color: 'text.secondary', fontWeight: 700, lineHeight: 1 }}>
            {side.rank > 0 ? `#${side.rank}` : 'NR'}
          </Typography>
          <Box sx={TEAM_LINK_SX}>
            <Typography variant={nameVariant} sx={{ lineHeight: 1 }}>
              {teamName}
            </Typography>
          </Box>
        </Stack>
        <Typography
          variant={ovrVariant}
          color="text.secondary"
          sx={{ fontWeight: 700, lineHeight: 1.1, mt: 0.25 }}
        >
          OVR {team.rating}
        </Typography>
        <Typography
          variant={recordVariant}
          color="text.secondary"
          sx={{ fontWeight: 700, lineHeight: 1.1, mt: 0.1 }}
        >
          {team.record}
        </Typography>
      </Box>
    </Box>
  );
};

export default function GameHeader({
  game,
  home,
  away,
  neutral,
  mode = 'preview',
  homeScore,
  awayScore,
  resultStatus,
  headlineSubtitle,
  homeSide,
  awaySide,
  onTeamClick,
}: GameHeaderProps) {
  const venueText = neutral ? 'Neutral Site' : `${home.stadium} • ${home.city}, ${home.state}`;
  const resolvedAwayScore = awayScore ?? awaySide.score ?? 0;
  const resolvedHomeScore = homeScore ?? homeSide.score ?? 0;
  const statusText = resultStatus ?? 'FINAL';

  return (
    <Paper elevation={1} sx={{ p: 1.75, border: '1px solid', borderColor: 'divider' }}>
      <Grid container alignItems="center" spacing={1.75}>
        <Grid size={{ xs: 12, md: 3.5 }}>
          {renderTeamHeader(away, awaySide, 'left', onTeamClick, mode)}
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ textAlign: 'center' }}>
            {mode === 'result' ? (
              <>
                <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 1.05, color: 'primary.main' }}>
                  {resolvedAwayScore} - {resolvedHomeScore}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.2 }}>
                  {statusText}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {(away.abbreviation || away.name).toUpperCase()} vs {(home.abbreviation || home.name).toUpperCase()}
                </Typography>
              </>
            ) : (
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.1, color: 'primary.main' }}>
                {formatMatchup(home.name, away.name, neutral)}
              </Typography>
            )}
            {game.label && (
              <Typography variant="h6" sx={{ fontWeight: 700, mt: mode === 'result' ? 0.35 : 0.45 }}>
                {game.label}
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.35 }}>
              Week {game.weekPlayed} • {game.year} • {venueText}
            </Typography>
            {mode === 'result' && game.headline && (
              <Typography variant="body2" sx={{ mt: 0.45, fontStyle: 'italic' }}>
                {game.headline}
              </Typography>
            )}
            {mode === 'result' && headlineSubtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.15 }}>
                {headlineSubtitle}
              </Typography>
            )}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 3.5 }}>
          {renderTeamHeader(home, homeSide, 'right', onTeamClick, mode)}
        </Grid>
      </Grid>
    </Paper>
  );
}
