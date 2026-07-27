import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import { formatOpponentPrefix } from '../../domain/utils/gameDisplay';
import { DashboardPanel } from './DashboardPanel';
import type { DashboardGame, DashboardTeamClickHandler } from './types';

type DashboardGameRowProps = {
  game: DashboardGame;
  onTeamClick: DashboardTeamClickHandler;
};

const DashboardGameRow = ({ game, onTeamClick }: DashboardGameRowProps) => {
  const opponent = game.opponent;
  if (!opponent) return null;

  const isCompleted = game.result.length > 0;
  const prefix = formatOpponentPrefix(game.location);

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
          }}
        >
          Week {game.weekPlayed}
        </Typography>
        {isCompleted && (
          <Chip
            label={game.result}
            size="small"
            color={game.result === 'W' ? 'success' : 'error'}
            variant="outlined"
            aria-label={game.result === 'W' ? 'Win' : 'Loss'}
          />
        )}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          mt: 0.75,
        }}
      >
        <TeamLogo name={opponent.name} size={34} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'baseline',
              minWidth: 0,
            }}
          >
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
            <Box sx={{ minWidth: 0 }}>
              <TeamLink name={opponent.name} onTeamClick={onTeamClick} />
            </Box>
          </Stack>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {opponent.ranking > 0 && `#${opponent.ranking} · `}
            {opponent.record}
            {game.label ? ` · ${game.label}` : ''}
          </Typography>
        </Box>
        {isCompleted && (
          <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>
            {game.score}
          </Typography>
        )}
      </Stack>
      {!isCompleted && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            mt: 1.25,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Spread
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {game.spread || '—'}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Moneyline
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {game.moneyline || '—'}
            </Typography>
          </Box>
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Button
          component={RouterLink}
          to={`/game/${game.id}`}
          size="small"
          variant="outlined"
          disabled={!game.id}
        >
          {isCompleted ? 'Game Summary' : 'Game Preview'}
        </Button>
      </Box>
    </Box>
  );
};

type DashboardGamesPanelProps = {
  previousGame: DashboardGame | null;
  currentGame: DashboardGame | null;
  onTeamClick: DashboardTeamClickHandler;
};

type GamePanelProps = {
  title: string;
  ariaLabel: string;
  emptyMessage: string;
  game: DashboardGame | null;
  onTeamClick: DashboardTeamClickHandler;
};

const GamePanel = ({ title, ariaLabel, emptyMessage, game, onTeamClick }: GamePanelProps) => (
  <DashboardPanel title={title} ariaLabel={ariaLabel}>
    {game?.opponent ? (
      <DashboardGameRow game={game} onTeamClick={onTeamClick} />
    ) : (
      <Box sx={{ p: 1.5 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {emptyMessage}
        </Typography>
      </Box>
    )}
  </DashboardPanel>
);

export const DashboardGamesPanel = ({
  previousGame,
  currentGame,
  onTeamClick,
}: DashboardGamesPanelProps) => (
  <Stack spacing={1.5} sx={{ minHeight: 0, alignSelf: 'start' }}>
    <GamePanel
      title="Previous Game"
      ariaLabel="Previous game"
      emptyMessage="No previous game is available."
      game={previousGame}
      onTeamClick={onTeamClick}
    />
    <GamePanel
      title="Current Game"
      ariaLabel="Current game"
      emptyMessage="No current game is available."
      game={currentGame}
      onTeamClick={onTeamClick}
    />
  </Stack>
);
