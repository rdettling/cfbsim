import { Link as RouterLink } from 'react-router-dom';
import { Button, Chip, Link, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import type { TeamScheduleGame } from './types';

type GameDetailProps = {
  game: TeamScheduleGame;
};

type ScheduleOpponentProps = GameDetailProps & {
  onClick: (teamName: string) => void;
};

export const ScheduleOpponent = ({ game, onClick }: ScheduleOpponentProps) => {
  if (!game.opponent) {
    return (
      <Typography
        sx={{
          color: 'text.secondary',
        }}
      >
        Bye week
      </Typography>
    );
  }

  const { opponent } = game;
  const ranked = opponent.ranking > 0 && opponent.ranking <= 25;

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <TeamLogo name={opponent.name} size={32} />
      <Stack spacing={0.125} sx={{ minWidth: 0 }}>
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
          {ranked && `#${opponent.ranking} `}
          {opponent.name}
        </Link>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          Rating {opponent.rating} · {opponent.record}
        </Typography>
      </Stack>
    </Stack>
  );
};

export const ScheduleSiteBadge = ({ game }: GameDetailProps) => {
  if (!game.location) return null;

  const label = game.venue
    ? `${game.venue} · ${game.location}`
    : game.location;
  return <Chip label={label} size="small" variant="outlined" />;
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
  if (!game.id) return null;

  const isComplete = Boolean(game.result);
  const resultLabel = game.score ? `${game.result} ${game.score}` : game.result;

  return (
    <Button
      component={RouterLink}
      to={`/game/${game.id}`}
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
