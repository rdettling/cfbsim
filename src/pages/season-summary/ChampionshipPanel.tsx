import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { SeasonSummaryChampionship, TeamSelectionHandler } from './types';

type ChampionshipPanelProps = {
  championship: SeasonSummaryChampionship | null;
  onTeamClick: TeamSelectionHandler;
};

const formatRank = (ranking: number) => (ranking > 0 ? `#${ranking}` : 'Unranked');

const ChampionshipTeamRow = ({
  team,
  score,
  winner,
  onTeamClick,
}: {
  team: SeasonSummaryChampionship['champion'];
  score: number;
  winner: boolean;
  onTeamClick: TeamSelectionHandler;
}) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '2.75rem minmax(0, 1fr) 3rem',
      gap: 0.75,
      alignItems: 'center',
      px: 1.25,
      py: 0.75,
      borderLeft: '3px solid',
      borderLeftColor: winner ? 'success.main' : 'transparent',
      borderBottom: '1px solid',
      borderBottomColor: 'divider',
      '&:last-of-type': { borderBottom: 0 },
    }}
  >
    <Box
      sx={{
        width: '2.75rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <TeamLogo name={team.name} size={30} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ fontWeight: winner ? 800 : 600 }}>
          <TeamLink name={team.name} onTeamClick={onTeamClick} />
        </Box>
        {winner && (
          <Chip
            label="Champion"
            size="small"
            color="success"
            variant="outlined"
            sx={{
              height: 20,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {team.totalWins}-{team.totalLosses} · {formatRank(team.ranking)}
      </Typography>
    </Box>
    <Typography
      variant="h5"
      sx={{
        fontWeight: winner ? 800 : 700,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score}
    </Typography>
  </Box>
);

export const ChampionshipPanel = ({
  championship,
  onTeamClick,
}: ChampionshipPanelProps) => (
  <Paper
    component="section"
    aria-labelledby="championship-title"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        id="championship-title"
        component="h2"
        variant="overline"
        sx={{ color: 'text.secondary', letterSpacing: 1 }}
      >
        National Championship
      </Typography>
      {championship && (
        <Button
          component={RouterLink}
          to={`/game/${championship.gameId}`}
          size="small"
          sx={{ minWidth: 0, px: 0.75, flexShrink: 0 }}
        >
          View game
        </Button>
      )}
    </Box>
    {championship ? (
      <Box
        sx={{
          display: 'grid',
          gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
          flex: 1,
          minHeight: 0,
        }}
      >
        <ChampionshipTeamRow
          team={championship.champion}
          score={championship.championScore}
          winner
          onTeamClick={onTeamClick}
        />
        <ChampionshipTeamRow
          team={championship.runnerUp}
          score={championship.runnerUpScore}
          winner={false}
          onTeamClick={onTeamClick}
        />
      </Box>
    ) : (
      <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography variant="subtitle2">Championship result unavailable</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          No completed national championship was returned for this season.
        </Typography>
      </Box>
    )}
  </Paper>
);
