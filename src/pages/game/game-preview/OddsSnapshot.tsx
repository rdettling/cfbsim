import { Box, Divider, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../../components/team/TeamLogo';
import type { Team } from '../../../types/domain';

type OddsSide = {
  spread: string;
  moneyline: string;
  winProb?: number;
};

type OddsSnapshotProps = {
  awayTeam: Team;
  homeTeam: Team;
  awaySide: OddsSide;
  homeSide: OddsSide;
};

const formatProbability = (value: number) => `${Math.round(value * 100)}%`;

export const OddsSnapshot = ({ awayTeam, homeTeam, awaySide, homeSide }: OddsSnapshotProps) => {
  const hasProbabilities =
    typeof awaySide.winProb === 'number' && typeof homeSide.winProb === 'number';

  return (
    <Paper component="section" variant="outlined" sx={{ p: 1.5, height: '100%' }}>
      <Typography component="h2" variant="h6">
        Odds Snapshot
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          alignItems: 'center',
          columnGap: 1.5,
          rowGap: 0.75,
          mt: 1,
        }}
      >
        <Box />
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'right',
          }}
        >
          Spread
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'right',
          }}
        >
          Moneyline
        </Typography>

        {[
          { team: awayTeam, side: awaySide },
          { team: homeTeam, side: homeSide },
        ].map(({ team, side }) => (
          <Box key={team.id} sx={{ display: 'contents' }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <TeamLogo name={team.name} size={22} />
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {team.abbreviation || team.name}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
              {side.spread || '—'}
            </Typography>
            <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
              {side.moneyline || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
      <Divider sx={{ my: 1.25 }} />
      {hasProbabilities ? (
        <Stack spacing={0.5}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {awayTeam.abbreviation || awayTeam.name} {formatProbability(awaySide.winProb!)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
              {homeTeam.abbreviation || homeTeam.name} {formatProbability(homeSide.winProb!)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.round(awaySide.winProb! * 100)}
            aria-label={`${awayTeam.name} win probability`}
            sx={{ height: 8, borderRadius: 1, bgcolor: 'action.hover' }}
          />
        </Stack>
      ) : (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          Win probabilities are unavailable for this matchup.
        </Typography>
      )}
    </Paper>
  );
};
