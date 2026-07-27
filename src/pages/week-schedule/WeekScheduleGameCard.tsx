import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import {
  formatMatchup,
  resolveHomeAway,
  resolveTeamSide,
} from '../../domain/utils/gameDisplay';
import type { WeekScheduleGameCardProps } from './types';

type TeamRowProps = {
  name: string;
  rank: number;
  site: 'Away' | 'Home' | 'Neutral';
  value: string | number;
  winner: boolean;
  onTeamClick: (name: string) => void;
};

const MatchupTeamRow = ({
  name,
  rank,
  site,
  value,
  winner,
  onTeamClick,
}: TeamRowProps) => {
  const ranked = rank > 0 && rank <= 25;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(0, 1fr) auto',
        gap: 1,
        alignItems: 'center',
        px: 1,
        py: 0.875,
        bgcolor: winner ? 'action.selected' : 'action.hover',
        borderRadius: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {site}
      </Typography>
      <Stack direction="row" spacing={0.875} alignItems="center" sx={{ minWidth: 0 }}>
        <TeamLogo name={name} size={28} />
        <Link
          component="button"
          type="button"
          onClick={() => onTeamClick(name)}
          aria-label={`View ${name} team information`}
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            color: 'text.primary',
            cursor: 'pointer',
            fontWeight: winner || ranked ? 600 : 500,
            lineHeight: 1.3,
            textAlign: 'left',
            textDecoration: 'none',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ranked && `#${rank} `}
          {name}
        </Link>
      </Stack>
      <Typography
        variant="body1"
        sx={{ fontWeight: winner ? 700 : 600, whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
    </Box>
  );
};

export const WeekScheduleGameCard = ({
  game,
  onTeamClick,
}: WeekScheduleGameCardProps) => {
  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const isComplete = game.winner;
  const awayWon = isComplete && awaySide.score > homeSide.score;
  const homeWon = isComplete && homeSide.score > awaySide.score;
  const overtime = game.overtime > 0
    ? game.overtime > 1
      ? `${game.overtime}OT`
      : 'OT'
    : null;
  const status = isComplete
    ? `Final${overtime ? ` · ${overtime}` : ''}`
    : 'Scheduled';
  const matchup = formatMatchup(home.name, away.name, neutral);

  return (
    <Paper
      component="article"
      variant="outlined"
      aria-label={matchup}
      sx={{ p: 1.5, height: '100%' }}
    >
      <Stack sx={{ height: '100%' }} spacing={1.25}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {game.label || 'Regular season'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {neutral ? 'Neutral site' : matchup}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Watchability {game.watchability}
          </Typography>
        </Stack>

        <Stack spacing={0.75}>
          <MatchupTeamRow
            name={away.name}
            rank={awaySide.rank}
            site={neutral ? 'Neutral' : 'Away'}
            value={isComplete ? awaySide.score : awaySide.spread || '—'}
            winner={awayWon}
            onTeamClick={onTeamClick}
          />
          <MatchupTeamRow
            name={home.name}
            rank={homeSide.rank}
            site={neutral ? 'Neutral' : 'Home'}
            value={isComplete ? homeSide.score : homeSide.spread || '—'}
            winner={homeWon}
            onTeamClick={onTeamClick}
          />
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
          sx={{ mt: 'auto' }}
        >
          <Typography variant="caption" color="text.secondary">
            {status}
          </Typography>
          <Button
            component={RouterLink}
            to={`/game/${game.id}`}
            size="small"
            variant={isComplete ? 'outlined' : 'contained'}
          >
            {isComplete ? 'Summary' : 'Preview'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
