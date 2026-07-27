import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../../components/team/TeamComponents';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';

type ResultSummary = NonNullable<GamePageData['resultSummary']>;
type TeamSummary = ResultSummary['teamA'];

type GameTeamComparisonProps = {
  awayTeam: Team;
  homeTeam: Team;
  awaySummary: TeamSummary | null;
  homeSummary: TeamSummary | null;
};

type ComparisonValue = string | number | undefined;

type ComparisonRow = {
  label: string;
  away: ComparisonValue;
  home: ComparisonValue;
};

const formatRate = (value: number | undefined) =>
  typeof value === 'number' ? value.toFixed(1) : undefined;

const formatFraction = (
  value: { made: number; attempts: number } | undefined
) => (value ? `${value.made}/${value.attempts}` : undefined);

const formatRedZone = (
  value: { tds: number; trips: number } | undefined
) => (value ? `${value.tds}/${value.trips}` : undefined);

const formatPossession = (seconds: number | undefined) => {
  if (typeof seconds !== 'number') return undefined;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

export const GameTeamComparison = ({
  awayTeam,
  homeTeam,
  awaySummary,
  homeSummary,
}: GameTeamComparisonProps) => {
  const rows: ComparisonRow[] = [
    { label: 'Total Yards', away: awaySummary?.totalYards, home: homeSummary?.totalYards },
    { label: 'Pass Yards', away: awaySummary?.passYards, home: homeSummary?.passYards },
    { label: 'Rush Yards', away: awaySummary?.rushYards, home: homeSummary?.rushYards },
    { label: 'First Downs', away: awaySummary?.firstDowns, home: homeSummary?.firstDowns },
    { label: 'Turnovers', away: awaySummary?.turnovers, home: homeSummary?.turnovers },
    {
      label: '3rd Down',
      away: formatFraction(awaySummary?.thirdDown),
      home: formatFraction(homeSummary?.thirdDown),
    },
    {
      label: '4th Down',
      away: formatFraction(awaySummary?.fourthDown),
      home: formatFraction(homeSummary?.fourthDown),
    },
    {
      label: 'Red Zone TD/Trips',
      away: formatRedZone(awaySummary?.redZone),
      home: formatRedZone(homeSummary?.redZone),
    },
    { label: 'Sacks Allowed', away: awaySummary?.sacksAllowed, home: homeSummary?.sacksAllowed },
    {
      label: 'Explosive Plays (20+)',
      away: awaySummary?.explosivePlays,
      home: homeSummary?.explosivePlays,
    },
    {
      label: 'Time of Possession',
      away: formatPossession(awaySummary?.timeOfPossessionSeconds),
      home: formatPossession(homeSummary?.timeOfPossessionSeconds),
    },
    {
      label: 'Yards/Play',
      away: formatRate(awaySummary?.yardsPerPlay),
      home: formatRate(homeSummary?.yardsPerPlay),
    },
    {
      label: 'Yards/Run',
      away: formatRate(awaySummary?.yardsPerRun),
      home: formatRate(homeSummary?.yardsPerRun),
    },
    {
      label: 'Yards/Pass',
      away: formatRate(awaySummary?.yardsPerPass),
      home: formatRate(homeSummary?.yardsPerPass),
    },
  ];

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Team statistics comparison"
      sx={{
        height: '100%',
        minHeight: 0,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography component="h2" variant="h6">
        Team Stats
      </Typography>

      {!awaySummary || !homeSummary ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Team statistics are unavailable for this game.
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 1,
              mt: 1,
              pb: 0.75,
            }}
          >
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
              <TeamLogo name={awayTeam.name} size={20} />
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {awayTeam.name}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={0.6}
              alignItems="center"
              justifyContent="flex-end"
              sx={{ minWidth: 0 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {homeTeam.name}
              </Typography>
              <TeamLogo name={homeTeam.name} size={20} />
            </Stack>
          </Box>
          <Divider />

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.map((row, index) => (
              <Box key={row.label}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(48px, 1fr) minmax(112px, 1.8fr) minmax(48px, 1fr)',
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.6,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.away ?? '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'center' }}>
                    {row.label}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
                    {row.home ?? '—'}
                  </Typography>
                </Box>
                {index < rows.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
};
