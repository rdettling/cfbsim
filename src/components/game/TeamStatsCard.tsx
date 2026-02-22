import { Box, Card, CardContent, Divider, Grid, Stack, Typography } from '@mui/material';
import type { GameResultProps } from '../../types/components';
import { TeamLogo } from '../team/TeamComponents';

const CARD_SX = { height: '100%', border: '1px solid', borderColor: 'divider' } as const;
const CARD_CONTENT_SX = { p: 1.7 } as const;

type ResultSummary = NonNullable<GameResultProps['data']['resultSummary']>;
type TeamSummary = ResultSummary['teamA'] | null;

interface TeamStatsCardProps {
  awaySummary: TeamSummary;
  homeSummary: TeamSummary;
  hasSummary: boolean;
  awayTeamName: string;
  homeTeamName: string;
  panelHeight?: number;
}

const TeamStatsCard = ({
  awaySummary,
  homeSummary,
  hasSummary,
  awayTeamName,
  homeTeamName,
  panelHeight,
}: TeamStatsCardProps) => {
  const showRate = (value: number | undefined) => (typeof value === 'number' ? value.toFixed(1) : '--');
  const showFraction = (
    value: { made: number; attempts: number } | undefined
  ) => (value ? `${value.made}/${value.attempts}` : '--');
  const showRedZone = (
    value: { tds: number; trips: number } | undefined
  ) => (value ? `${value.tds}/${value.trips}` : '--');
  const showTop = (seconds: number | undefined) => {
    if (typeof seconds !== 'number') return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const statRows = [
    { label: 'Total Yards', away: awaySummary?.totalYards, home: homeSummary?.totalYards },
    { label: 'Pass Yards', away: awaySummary?.passYards, home: homeSummary?.passYards },
    { label: 'Rush Yards', away: awaySummary?.rushYards, home: homeSummary?.rushYards },
    { label: 'First Downs', away: awaySummary?.firstDowns, home: homeSummary?.firstDowns },
    { label: 'Turnovers', away: awaySummary?.turnovers, home: homeSummary?.turnovers },
    {
      label: '3rd Down',
      away: showFraction(awaySummary?.thirdDown),
      home: showFraction(homeSummary?.thirdDown),
    },
    { label: '4th Down', away: showFraction(awaySummary?.fourthDown), home: showFraction(homeSummary?.fourthDown) },
    { label: 'Red Zone TD/Trips', away: showRedZone(awaySummary?.redZone), home: showRedZone(homeSummary?.redZone) },
    { label: 'Sacks Allowed', away: awaySummary?.sacksAllowed, home: homeSummary?.sacksAllowed },
    { label: 'Explosive Plays (20+)', away: awaySummary?.explosivePlays, home: homeSummary?.explosivePlays },
    { label: 'Time of Possession', away: showTop(awaySummary?.timeOfPossessionSeconds), home: showTop(homeSummary?.timeOfPossessionSeconds) },
    { label: 'Yards/Play', away: showRate(awaySummary?.yardsPerPlay), home: showRate(homeSummary?.yardsPerPlay) },
    { label: 'Yards/Run', away: showRate(awaySummary?.yardsPerRun), home: showRate(homeSummary?.yardsPerRun) },
    { label: 'Yards/Pass', away: showRate(awaySummary?.yardsPerPass), home: showRate(homeSummary?.yardsPerPass) },
  ];

  return (
    <Card elevation={1} sx={{ ...CARD_SX, height: panelHeight ?? '100%' }}>
      <CardContent
        sx={{
          ...CARD_CONTENT_SX,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          Team Stats
        </Typography>
        {!hasSummary ? (
          <Typography variant="body2" color="text.secondary">
            Team stats are not available.
          </Typography>
        ) : (
          <Stack spacing={0.55} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.2 }}>
            <Grid container alignItems="center" sx={{ pb: 0.5 }}>
              <Grid size={{ xs: 3.5 }}>
                <Stack direction="row" spacing={0.55} alignItems="center">
                  <TeamLogo name={awayTeamName} size={20} />
                  <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>
                    {awayTeamName}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 5 }} />
              <Grid size={{ xs: 3.5 }}>
                <Stack direction="row" spacing={0.55} alignItems="center" justifyContent="flex-end">
                  <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>
                    {homeTeamName}
                  </Typography>
                  <TeamLogo name={homeTeamName} size={20} />
                </Stack>
              </Grid>
            </Grid>
            <Divider sx={{ mb: 0.2 }} />
            {statRows.map((row, index) => (
              <Box key={row.label}>
                <Grid container alignItems="center">
                  <Grid size={{ xs: 3.5 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {row.away ?? '--'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 5 }}>
                    <Typography variant="body1" sx={{ textAlign: 'center', fontWeight: 700 }}>
                      {row.label}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 3.5 }}>
                    <Typography variant="body1" sx={{ textAlign: 'right', fontWeight: 700 }}>
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
  );
};

export default TeamStatsCard;
