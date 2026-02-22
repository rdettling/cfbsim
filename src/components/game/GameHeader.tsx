import { Box, Paper, Typography } from '@mui/material';
import { TeamLogo, TeamLink } from '../team/TeamComponents';
import type { GameHeaderProps } from '../../types/components';

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
  const isResult = mode === 'result';
  const logoSize = isResult ? 30 : 40;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          textAlign: align,
          display: 'grid',
          gap: isResult ? 0.18 : 0.25,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: isResult ? 0.7 : 0.8,
            minWidth: 0,
            minHeight: logoSize,
          }}
        >
          <Box sx={{ lineHeight: 0, flexShrink: 0 }}>
            <TeamLogo name={team.name} size={logoSize} />
          </Box>
          <Typography
            variant="h5"
            sx={{ color: 'text.secondary', fontWeight: 700, lineHeight: 1, flexShrink: 0 }}
          >
            {side.rank > 0 ? `#${side.rank}` : 'NR'}
          </Typography>
          <Box sx={TEAM_LINK_SX}>
            <Typography
              variant="h4"
              sx={{
                lineHeight: 1,
                fontWeight: 800,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {teamName}
            </Typography>
          </Box>
        </Box>
        <Typography
          variant={isResult ? 'h5' : 'h6'}
          color="text.secondary"
          sx={{ fontWeight: 700, lineHeight: 1.1, mt: isResult ? 0.15 : 0.2 }}
        >
          OVR {team.rating}
        </Typography>
        <Typography
          variant={isResult ? 'h5' : 'h6'}
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
  const isResult = mode === 'result';

  return (
    <Paper
      elevation={1}
      sx={{
        p: isResult ? 1.05 : 1.75,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          alignItems: 'center',
          gap: isResult ? 1 : 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(260px, 1fr) minmax(340px, 1.15fr) minmax(260px, 1fr)',
          },
        }}
      >
        <Box>
          {renderTeamHeader(away, awaySide, 'left', onTeamClick, mode)}
        </Box>
        <Box>
          <Box sx={{ textAlign: 'center' }}>
            {mode === 'result' ? (
              <>
                <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: 'primary.main' }}>
                  {resolvedAwayScore} - {resolvedHomeScore}
                </Typography>
                {game.label && (
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.2, lineHeight: 1.1 }}>
                    {game.label}
                  </Typography>
                )}
              </>
            ) : null}
            {mode === 'preview' && game.label && (
              <Typography
                variant={isResult ? 'h6' : 'h6'}
                sx={{ fontWeight: 700, mt: 0.45, lineHeight: 1.1 }}
              >
                {game.label}
              </Typography>
            )}
            <Typography
              variant={isResult ? 'body1' : 'body1'}
              color="text.secondary"
              sx={{ mt: isResult ? 0.15 : 0.3, lineHeight: 1.15 }}
            >
              Week {game.weekPlayed} • {game.year} • {venueText}
            </Typography>
            {mode === 'result' && game.headline && (
              <Typography variant="body1" sx={{ mt: 0.25, fontStyle: 'italic', lineHeight: 1.2 }}>
                {game.headline}
              </Typography>
            )}
            {mode === 'result' && headlineSubtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.1, lineHeight: 1.15 }}
              >
                {headlineSubtitle}
              </Typography>
            )}
          </Box>
        </Box>
        <Box>
          {renderTeamHeader(home, homeSide, 'right', onTeamClick, mode)}
        </Box>
      </Box>
    </Paper>
  );
}
