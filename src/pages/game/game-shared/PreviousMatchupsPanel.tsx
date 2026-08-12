import { Box, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../../../components/team/TeamLogo';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';
import { GamePanel } from './GamePanel';

type PreviousMatchup = GamePageData['previousMatchups']['rows'][number];

type PreviousMatchupsPanelProps = {
  teamA: Team;
  teamB: Team;
  awayTeamId: number;
  matchups: PreviousMatchup[];
  series: GamePageData['previousMatchups']['series'];
};

export const PreviousMatchupsPanel = ({
  teamA,
  teamB,
  awayTeamId,
  matchups,
  series,
}: PreviousMatchupsPanelProps) => {
  if (matchups.length === 0) return null;

  const awayIsTeamA = awayTeamId === teamA.id;
  const awayTeam = awayIsTeamA ? teamA : teamB;
  const homeTeam = awayIsTeamA ? teamB : teamA;
  const tiesSuffix = series.ties > 0 ? `–${series.ties}` : '';
  const seriesSummary = series.teamAWins === series.teamBWins
    ? `Series · Tied ${series.teamAWins}–${series.teamBWins}${tiesSuffix}`
    : series.teamAWins > series.teamBWins
      ? `Series · ${teamA.name} ${series.teamAWins}–${series.teamBWins}${tiesSuffix}`
      : `Series · ${teamB.name} ${series.teamBWins}–${series.teamAWins}${tiesSuffix}`;

  return (
    <GamePanel
      title="Previous Matchups"
      ariaLabel="Previous matchups"
      actions={(
        <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {seriesSummary}
        </Typography>
      )}
      scrollable
    >
      <Stack divider={<Divider flexItem />}>
        {matchups.map(matchup => {
          const awayScore = awayIsTeamA ? matchup.teamAScore : matchup.teamBScore;
          const homeScore = awayIsTeamA ? matchup.teamBScore : matchup.teamAScore;
          const awayWon = awayIsTeamA
            ? matchup.winnerSide === 'teamA'
            : matchup.winnerSide === 'teamB';
          const homeWon = awayIsTeamA
            ? matchup.winnerSide === 'teamB'
            : matchup.winnerSide === 'teamA';
          const hasWinner = matchup.winnerSide !== null;

          const teamIdentity = (team: Team, won: boolean, align: 'left' | 'right') => (
            <Box
              sx={{
                display: 'flex',
                flexDirection: align === 'right' ? 'row-reverse' : 'row',
                gap: 0.75,
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  width: 28,
                  display: 'flex',
                  justifyContent: 'center',
                  flexShrink: 0,
                  '& img': { maxWidth: 28 },
                }}
              >
                <TeamLogo name={team.name} size={24} />
              </Box>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontWeight: won ? 700 : 500,
                  color: hasWinner && !won ? 'text.secondary' : 'text.primary',
                  textAlign: align,
                }}
              >
                {team.name}
              </Typography>
            </Box>
          );

          const score = (value: number, won: boolean) => (
            <Typography
              variant="body1"
              sx={{
                minWidth: '2ch',
                textAlign: 'center',
                fontWeight: won ? 800 : 600,
                color: hasWinner && !won ? 'text.secondary' : 'text.primary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </Typography>
          );

          const content = (
            <>
              <Stack
                direction="row"
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                  mb: 0.625,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}
                >
                  {matchup.year} · Week {matchup.week}
                </Typography>
                {matchup.label && (
                  <Typography
                    variant="caption"
                    noWrap
                    title={matchup.label}
                    sx={{
                      color: 'text.secondary',
                      maxWidth: '58%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {matchup.label}
                  </Typography>
                )}
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto auto minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 0.75,
                  minHeight: 32,
                }}
              >
                {teamIdentity(awayTeam, awayWon, 'left')}
                {score(awayScore, awayWon)}
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>–</Typography>
                {score(homeScore, homeWon)}
                {teamIdentity(homeTeam, homeWon, 'right')}
              </Box>
            </>
          );

          const rowStyles = {
            display: 'block',
            px: 0.5,
            py: 1,
            color: 'text.primary',
            textDecoration: 'none',
            borderRadius: 0.75,
          } as const;

          return matchup.gameId !== null ? (
            <Box
              key={matchup.rowKey}
              component={RouterLink}
              to={`/game/${matchup.gameId}`}
              sx={{
                ...rowStyles,
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: -2,
                },
              }}
            >
              {content}
            </Box>
          ) : (
            <Box key={matchup.rowKey} sx={rowStyles}>
              {content}
            </Box>
          );
        })}
      </Stack>
    </GamePanel>
  );
};
