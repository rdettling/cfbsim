import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { NonConScheduleGame, TeamSelectionHandler } from './types';

type NonConSchedulePanelProps = {
  schedule: NonConScheduleGame[];
  remainingManualGames: number;
  selectedWeek: number | null;
  onSchedule: (week: number) => void;
  onTeamClick: TeamSelectionHandler;
  onRemoveGame: (gameId: string) => void;
  removingItemKey: string | null;
};

const rowColumns = {
  xs: '36px minmax(0, 1fr) auto',
  sm: '48px minmax(0, 1fr) minmax(116px, 0.32fr) auto',
};

const ScheduleRow = ({
  game,
  canSchedule,
  selected,
  onSchedule,
  onTeamClick,
  onRemoveGame,
  removingItemKey,
}: {
  game: NonConScheduleGame;
  canSchedule: boolean;
  selected: boolean;
  onSchedule: (week: number) => void;
  onTeamClick: TeamSelectionHandler;
  onRemoveGame: (gameId: string) => void;
  removingItemKey: string | null;
}) => {
  const removing = removingItemKey === `game:${game.id}`;
  const mutationBusy = removingItemKey !== null;
  const siteStatus = game.opponent
    ? game.venue
      ? `${game.location ?? 'Scheduled'} · ${game.venue}`
      : game.location ?? 'Scheduled'
    : canSchedule
      ? 'Manual option'
      : 'Automatic fill';

  return (
    <Box
      component="article"
      data-selected={selected || undefined}
      sx={{
        display: 'grid',
        gridTemplateColumns: rowColumns,
        gap: { xs: 0.75, sm: 1 },
        alignItems: 'center',
        minHeight: { xs: 48, lg: 40 },
        px: 1.25,
        py: { xs: 0.75, lg: 0.375 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: selected ? 'action.selected' : 'transparent',
        boxShadow: selected ? theme => `inset 3px 0 ${theme.palette.primary.main}` : 'none',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'center' }}>
        {game.weekPlayed}
      </Typography>

      <Box sx={{ minWidth: 0 }}>
        {game.opponent ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
            <TeamLogo name={game.opponent.name} size={24} />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                {game.opponent.ranking > 0 && (
                  <Typography variant="caption" sx={{ fontWeight: 700, flexShrink: 0 }}>
                    #{game.opponent.ranking}
                  </Typography>
                )}
                <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <TeamLink name={game.opponent.name} onTeamClick={onTeamClick} />
                </Box>
              </Stack>
              <Typography
                variant="caption"
                title={game.label}
                sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {game.label ?? 'Scheduled matchup'}
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  {' · '}{siteStatus}
                </Box>
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Open week
          </Typography>
        )}
      </Box>

      <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
        <Typography
          variant="caption"
          title={game.venue ?? undefined}
          sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {siteStatus}
        </Typography>
      </Box>

      <Box sx={{ justifySelf: 'end' }}>
        {game.opponent ? (
          <Button
            variant="text"
            color="error"
            size="small"
            disabled={mutationBusy}
            aria-label={`Remove ${game.opponent.name} from Week ${game.weekPlayed}`}
            onClick={() => onRemoveGame(game.id)}
          >
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        ) : canSchedule ? (
          <Button
            variant={selected ? 'contained' : 'outlined'}
            size="small"
            aria-pressed={selected}
            onClick={() => onSchedule(game.weekPlayed)}
          >
            {selected ? 'Selected' : 'Choose'}
          </Button>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
            Auto-fill
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export const NonConSchedulePanel = ({
  schedule,
  remainingManualGames,
  selectedWeek,
  onSchedule,
  onTeamClick,
  onRemoveGame,
  removingItemKey,
}: NonConSchedulePanelProps) => (
  <Paper
    component="section"
    aria-label="14-Week Schedule"
    variant="outlined"
    sx={{ display: 'flex', flexDirection: 'column', height: { lg: '100%' }, minHeight: 0, overflow: 'hidden' }}
  >
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', minHeight: 38, px: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography component="h2" variant="subtitle2">Schedule</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>14 weeks</Typography>
    </Stack>

    <Box
      aria-hidden="true"
      sx={{
        display: { xs: 'none', sm: 'grid' },
        gridTemplateColumns: rowColumns,
        gap: 1,
        px: 1.25,
        py: 0.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.secondary',
        backgroundColor: 'action.hover',
      }}
    >
      <Typography variant="caption" sx={{ textAlign: 'center' }}>Week</Typography>
      <Typography variant="caption">Matchup</Typography>
      <Typography variant="caption">Site / status</Typography>
      <Typography variant="caption" sx={{ textAlign: 'right' }}>Action</Typography>
    </Box>

    <Box sx={{ flex: 1, minHeight: 0, overflowY: { xs: 'visible', lg: 'auto' } }}>
      {schedule.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle2">Schedule unavailable</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>No preseason weeks were returned.</Typography>
        </Box>
      ) : schedule.map(game => (
        <ScheduleRow
          key={game.weekPlayed}
          game={game}
          canSchedule={!game.opponent && remainingManualGames > 0}
          selected={selectedWeek === game.weekPlayed}
          onSchedule={onSchedule}
          onTeamClick={onTeamClick}
          onRemoveGame={onRemoveGame}
          removingItemKey={removingItemKey}
        />
      ))}
    </Box>
  </Paper>
);
