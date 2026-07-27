import { Link as RouterLink } from 'react-router-dom';
import { Link, Stack, Typography } from '@mui/material';
import { formatOpponentPrefix } from '../../domain/utils/gameDisplay';
import type { ScheduleGame } from '../../types/domain';
import { TeamLogo } from '../team/TeamComponents';

type CompactGameSummaryProps = {
  game: ScheduleGame | null;
  mode: 'previous' | 'upcoming';
  onOpponentClick: (name: string) => void;
};

export const CompactGameSummary = ({ game, mode, onOpponentClick }: CompactGameSummaryProps) => {
  if (!game?.opponent) {
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

  const prefix = formatOpponentPrefix(game.location);
  const ranked = game.opponent.ranking > 0 && game.opponent.ranking <= 25;
  const detail =
    mode === 'previous' ? [game.result, game.score].filter(Boolean).join(' ') : game.spread;

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: 'center',
        minWidth: 0,
        flexWrap: 'wrap',
        rowGap: 0.5,
      }}
    >
      {detail &&
        mode === 'previous' &&
        (game.id ? (
          <Link
            component={RouterLink}
            to={`/game/${game.id}`}
            underline="hover"
            sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            {detail}
          </Link>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            {detail}
          </Typography>
        ))}
      {prefix && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {prefix}
        </Typography>
      )}
      <TeamLogo name={game.opponent.name} size={22} />
      <Link
        component="button"
        type="button"
        onClick={() => onOpponentClick(game.opponent!.name)}
        aria-label={`View ${game.opponent.name} team information`}
        sx={{
          cursor: 'pointer',
          fontWeight: ranked ? 600 : 500,
          lineHeight: 1.3,
          textAlign: 'left',
          textDecoration: 'none',
        }}
      >
        {ranked && `#${game.opponent.ranking} `}
        {game.opponent.name}
      </Link>
      {detail &&
        mode === 'upcoming' &&
        (game.id ? (
          <Link
            component={RouterLink}
            to={`/game/${game.id}`}
            underline="hover"
            sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            {detail}
          </Link>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            {detail}
          </Typography>
        ))}
    </Stack>
  );
};
