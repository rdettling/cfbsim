import { Box, Divider, LinearProgress, Link, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';

type OddsSide = {
  spread: string;
  moneyline: string;
  winProb?: number;
};

type GameContextPanelProps = {
  awayTeam: Team;
  homeTeam: Team;
  awaySide: OddsSide;
  homeSide: OddsSide;
  dynastyContext: GamePageData['dynastyContext'];
  completed: boolean;
};

const formatProbability = (value: number) => `${Math.round(value * 100)}%`;

export const GameContextPanel = ({
  awayTeam,
  homeTeam,
  awaySide,
  homeSide,
  dynastyContext,
  completed,
}: GameContextPanelProps) => {
  const hasProbabilities =
    typeof awaySide.winProb === 'number' && typeof homeSide.winProb === 'number';

  return (
    <Paper component="section" variant="outlined" aria-label="Game context" sx={{ p: 1.25 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
          {completed ? 'Pregame odds' : 'Matchup odds'}
        </Typography>
        {hasProbabilities && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Win probability
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          columnGap: 1.25,
          rowGap: 0.35,
          alignItems: 'center',
          mt: 0.65,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Team</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'right' }}>Spread</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'right' }}>ML</Typography>
        {[
          { team: awayTeam, side: awaySide },
          { team: homeTeam, side: homeSide },
        ].map(({ team, side }) => (
          <Box key={team.id} sx={{ display: 'contents' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {team.abbreviation || team.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {side.spread || '—'}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {side.moneyline || '—'}
            </Typography>
          </Box>
        ))}
      </Box>

      {hasProbabilities && (
        <Box sx={{ mt: 0.75 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {awayTeam.abbreviation || awayTeam.name} {formatProbability(awaySide.winProb!)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {homeTeam.abbreviation || homeTeam.name} {formatProbability(homeSide.winProb!)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.round(awaySide.winProb! * 100)}
            aria-label={`${awayTeam.name} win probability`}
            sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover' }}
          />
        </Box>
      )}

      {dynastyContext && (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack
            direction={{ xs: 'column', sm: 'row', lg: 'column' }}
            spacing={0.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                Dynasty context
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                {dynastyContext.callback}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexShrink: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Series {dynastyContext.wins}-{dynastyContext.losses}
              </Typography>
              {dynastyContext.streak && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {dynastyContext.streak}
                </Typography>
              )}
              {dynastyContext.lastMeeting && (
                <Link
                  component={RouterLink}
                  to={`/game/${dynastyContext.lastMeeting.id}`}
                  variant="caption"
                  underline="hover"
                >
                  Last meeting
                </Link>
              )}
            </Stack>
          </Stack>
        </>
      )}
    </Paper>
  );
};
