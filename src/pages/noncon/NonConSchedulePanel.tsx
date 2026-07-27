import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import type { NonConScheduleGame, TeamSelectionHandler } from './types';

type NonConSchedulePanelProps = {
  schedule: NonConScheduleGame[];
  remainingManualGames: number;
  onSchedule: (week: number) => void;
  onTeamClick: TeamSelectionHandler;
};

const ScheduleRow = ({
  game,
  canSchedule,
  onSchedule,
  onTeamClick,
}: {
  game: NonConScheduleGame;
  canSchedule: boolean;
  onSchedule: (week: number) => void;
  onTeamClick: TeamSelectionHandler;
}) => (
  <Box
    component="article"
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '52px minmax(0, 1fr)', sm: '64px minmax(0, 1fr) auto' },
      gap: 1.25,
      alignItems: 'center',
      px: { xs: 1.25, md: 1.5 },
      py: 1.15,
      borderBottom: '1px solid',
      borderColor: 'divider',
      '&:last-of-type': { borderBottom: 0 },
    }}
  >
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
        }}
      >
        Week
      </Typography>
      <Typography variant="h6">{game.weekPlayed}</Typography>
    </Box>

    <Box sx={{ minWidth: 0 }}>
      {game.opponent ? (
        <>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
            }}
          >
            <TeamLogo name={game.opponent.name} size={30} />
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                useFlexGap
                sx={{
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {game.opponent.ranking > 0 && (
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    #{game.opponent.ranking}
                  </Typography>
                )}
                <TeamLink name={game.opponent.name} onTeamClick={onTeamClick} />
              </Stack>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                }}
              >
                {game.label ?? 'Scheduled matchup'}
              </Typography>
            </Box>
          </Stack>
          {game.location && (
            <Chip label={game.location} size="small" variant="outlined" sx={{ mt: 0.75 }} />
          )}
        </>
      ) : (
        <>
          <Typography variant="subtitle2">Open Week</Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {canSchedule
              ? 'Available for a manual non-conference game.'
              : 'This week will be handled during automatic schedule completion.'}
          </Typography>
        </>
      )}
    </Box>

    <Box sx={{ gridColumn: { xs: '2', sm: 'auto' }, justifySelf: { xs: 'start', sm: 'end' } }}>
      {game.opponent ? (
        <Chip label="Scheduled" size="small" variant="outlined" />
      ) : canSchedule ? (
        <Button variant="contained" size="small" onClick={() => onSchedule(game.weekPlayed)}>
          Schedule Game
        </Button>
      ) : (
        <Chip label="Auto-fill" size="small" variant="outlined" />
      )}
    </Box>
  </Box>
);

export const NonConSchedulePanel = ({
  schedule,
  remainingManualGames,
  onSchedule,
  onTeamClick,
}: NonConSchedulePanelProps) => (
  <Paper
    component="section"
    aria-label="14-Week Schedule"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
    }}
  >
    <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography component="h2" variant="h6">
        14-Week Schedule
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        Fixed rivalry games and your open scheduling opportunities
      </Typography>
    </Box>

    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {schedule.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Schedule unavailable
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            No preseason schedule weeks were returned.
          </Typography>
        </Box>
      ) : (
        schedule.map((game) => (
          <ScheduleRow
            key={game.weekPlayed}
            game={game}
            canSchedule={!game.opponent && remainingManualGames > 0}
            onSchedule={onSchedule}
            onTeamClick={onTeamClick}
          />
        ))
      )}
    </Box>
  </Paper>
);
