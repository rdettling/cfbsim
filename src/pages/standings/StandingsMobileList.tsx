import { Box, Paper, Stack, Typography } from '@mui/material';
import { CompactGameSummary } from '../../components/game/CompactGameSummary';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import type { StandingsViewProps } from './types';

export const StandingsMobileList = ({
  teams,
  isIndependent,
  onTeamClick,
}: StandingsViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label="Conference standings"
    sx={{ display: { xs: 'block', md: 'none' }, overflow: 'hidden' }}
  >
    {teams.map((team, index) => (
      <Box
        key={team.name}
        sx={{
          p: 1.5,
          borderBottom: index === teams.length - 1 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Typography
            variant="h6"
            sx={{ width: 28, flexShrink: 0, textAlign: 'center' }}
          >
            {index + 1}
          </Typography>
          <TeamLogo name={team.name} size={36} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <TeamLink name={team.name} onTeamClick={onTeamClick} />
            <Typography variant="caption" color="text.secondary" display="block">
              {team.confName ?? team.conference}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: isIndependent ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            mt: 1.5,
          }}
        >
          {!isIndependent && (
            <Box>
              <Typography variant="caption" color="text.secondary">Conference</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {team.confWins}-{team.confLosses}
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary">Overall</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {team.totalWins}-{team.totalLosses}
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
              Last week
            </Typography>
            <CompactGameSummary
              game={team.last_game}
              mode="previous"
              onOpponentClick={onTeamClick}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
              This week
            </Typography>
            <CompactGameSummary
              game={team.next_game}
              mode="upcoming"
              onOpponentClick={onTeamClick}
            />
          </Box>
        </Stack>
      </Box>
    ))}
  </Paper>
);
