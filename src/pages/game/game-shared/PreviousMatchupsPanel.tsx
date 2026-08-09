import { Box, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';
import { GamePanel } from './GamePanel';

type PreviousMatchup = GamePageData['previousMatchups'][number];

type PreviousMatchupsPanelProps = {
  teamA: Team;
  teamB: Team;
  awayTeamId: number;
  matchups: PreviousMatchup[];
};

export const PreviousMatchupsPanel = ({ teamA, teamB, awayTeamId, matchups }: PreviousMatchupsPanelProps) => {
  if (matchups.length === 0) return null;

  const awayIsTeamA = awayTeamId === teamA.id;
  const awayTeam = awayIsTeamA ? teamA : teamB;
  const homeTeam = awayIsTeamA ? teamB : teamA;

  return (
    <GamePanel title="Previous Matchups" ariaLabel="Previous matchups" scrollable>
      <Stack divider={<Divider flexItem />}>
        {matchups.map(matchup => {
          const awayScore = awayIsTeamA ? matchup.teamAScore : matchup.teamBScore;
          const homeScore = awayIsTeamA ? matchup.teamBScore : matchup.teamAScore;
          const awayWon = matchup.winnerId === awayTeam.id;
          const homeWon = matchup.winnerId === homeTeam.id;

          return (
            <Box
              key={matchup.id}
              component={RouterLink}
              to={`/game/${matchup.id}`}
              sx={{
                display: 'block',
                py: 0.75,
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {matchup.year} · Week {matchup.week}
                </Typography>
                {matchup.label && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {matchup.label}
                  </Typography>
                )}
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto auto minmax(0, 1fr)',
                  alignItems: 'baseline',
                  gap: 0.5,
                  mt: 0.25,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: awayWon ? 700 : 500 }} noWrap>
                  {awayTeam.abbreviation || awayTeam.name}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: awayWon ? 800 : 600 }}>
                  {awayScore}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>–</Typography>
                <Typography variant="body2" sx={{ fontWeight: homeWon ? 800 : 600 }}>
                  {homeScore}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: homeWon ? 700 : 500, textAlign: 'right' }}
                  noWrap
                >
                  {homeTeam.abbreviation || homeTeam.name}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </GamePanel>
  );
};
