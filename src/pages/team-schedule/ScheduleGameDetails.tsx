import { Link as RouterLink } from 'react-router-dom';
import { Button, Chip, Link, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { TeamScheduleGame } from './types';

type GameDetailProps = {
  game: TeamScheduleGame;
};

type ScheduleOpponentProps = GameDetailProps & {
  onClick: (teamName: string) => void;
};

export const ScheduleOpponent = ({ game, onClick }: ScheduleOpponentProps) => {
  const { opponent } = game;
  const ranked = opponent.ranking > 0 && opponent.ranking <= 25;
  const opponentName = (
    <>
      {ranked && `#${opponent.ranking} `}
      {opponent.name}
    </>
  );

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      {opponent.canOpen && <TeamLogo name={opponent.name} size={32} />}
      <Stack spacing={0.125} sx={{ minWidth: 0 }}>
        {opponent.canOpen ? (
          <Link
            component="button"
            type="button"
            onClick={() => onClick(opponent.name)}
            aria-label={`View ${opponent.name} team information`}
            sx={{
              alignSelf: 'flex-start',
              cursor: 'pointer',
              fontWeight: ranked ? 600 : 500,
              lineHeight: 1.3,
              textAlign: 'left',
              textDecoration: 'none',
            }}
          >
            {opponentName}
          </Link>
        ) : (
          <Typography sx={{ fontWeight: ranked ? 600 : 500, lineHeight: 1.3 }}>
            {opponentName}
          </Typography>
        )}
        {(opponent.rating !== null || opponent.record !== null) && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {opponent.rating !== null && `Rating ${opponent.rating}`}
            {opponent.rating !== null && opponent.record !== null && ' · '}
            {opponent.record}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
};

export const ScheduleGameLabel = ({ game }: GameDetailProps) => {
  if (!game.label) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        —
      </Typography>
    );
  }

  return (
    <Chip
      label={game.label}
      size="small"
      variant="outlined"
      sx={{
        maxWidth: '100%',
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
    />
  );
};

export const ScheduleGameAction = ({ game }: GameDetailProps) => {
  const isComplete = game.result !== null;
  const resultLabel = game.score ? `${game.result} ${game.score}` : game.result;

  if (!game.gameId) {
    if (!isComplete) return null;
    return (
      <Chip
        label={resultLabel}
        color={game.result === 'W' ? 'success' : 'error'}
        size="small"
        variant="outlined"
        aria-label={`Game result: ${resultLabel}`}
      />
    );
  }

  return (
    <Button
      component={RouterLink}
      to={`/game/${game.gameId}`}
      variant={isComplete ? 'outlined' : 'contained'}
      color={game.result === 'W' ? 'success' : game.result === 'L' ? 'error' : 'primary'}
      size="small"
      aria-label={isComplete ? `View game result: ${resultLabel}` : 'View game preview'}
      sx={{ minWidth: 92, whiteSpace: 'nowrap' }}
    >
      {isComplete ? resultLabel : 'Preview'}
    </Button>
  );
};
