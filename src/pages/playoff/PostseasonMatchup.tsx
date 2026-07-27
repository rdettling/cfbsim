import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import type { GameAction, PlayoffMatchup, TeamAction } from './types';

type PostseasonMatchupProps = {
  matchup: PlayoffMatchup;
  onGameClick: GameAction;
  onTeamClick: TeamAction;
  compact?: boolean;
};

const getDisplayTeam = (team: string) =>
  team.startsWith('Winner of') ? 'TBD' : team;

const MatchupTeam = ({
  name,
  seed,
  score,
  winner,
  onTeamClick,
}: {
  name: string;
  seed: number | null;
  score: number | null;
  winner: boolean;
  onTeamClick: TeamAction;
}) => {
  const displayName = getDisplayTeam(name);
  const isTbd = displayName === 'TBD';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        minHeight: 34,
        px: 1,
        py: 0.5,
        borderLeft: '3px solid',
        borderLeftColor: winner ? 'primary.main' : 'transparent',
        bgcolor: winner ? 'action.selected' : 'transparent',
      }}
    >
      <Typography
        variant="caption"
        color={seed !== null && seed <= 4 ? 'primary.main' : 'text.secondary'}
        sx={{ fontWeight: 700, textAlign: 'center' }}
      >
        {seed ?? '—'}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
        {!isTbd && <TeamLogo name={name} size={22} />}
        {isTbd ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            TBD
          </Typography>
        ) : (
          <Button
            variant="text"
            size="small"
            onClick={() => onTeamClick(name)}
            sx={{
              minWidth: 0,
              p: 0,
              justifyContent: 'flex-start',
              color: 'text.primary',
              fontWeight: winner ? 700 : 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </Button>
        )}
      </Stack>
      <Typography
        variant="body2"
        sx={{ minWidth: 20, textAlign: 'right', fontWeight: winner ? 700 : 500 }}
      >
        {score ?? ''}
      </Typography>
    </Box>
  );
};

export const PostseasonMatchup = ({
  matchup,
  onGameClick,
  onTeamClick,
  compact = false,
}: PostseasonMatchupProps) => {
  const hasResult = matchup.score1 !== null || matchup.score2 !== null;

  return (
    <Paper
      variant="outlined"
      sx={{
        width: '100%',
        minWidth: compact ? 188 : 210,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <MatchupTeam
        name={matchup.team1}
        seed={matchup.seed1}
        score={matchup.score1}
        winner={hasResult && matchup.winner === matchup.team1}
        onTeamClick={onTeamClick}
      />
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />
      <MatchupTeam
        name={matchup.team2}
        seed={matchup.seed2}
        score={matchup.score2}
        winner={hasResult && matchup.winner === matchup.team2}
        onTeamClick={onTeamClick}
      />
      {matchup.game_id !== undefined && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1,
            py: 0.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Chip
            label={hasResult ? 'Final' : 'Scheduled'}
            size="small"
            variant="outlined"
            sx={{ height: 20 }}
          />
          <Button size="small" onClick={() => onGameClick(matchup.game_id!)}>
            View game
          </Button>
        </Box>
      )}
    </Paper>
  );
};
