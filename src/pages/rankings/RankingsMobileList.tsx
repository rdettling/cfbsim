import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { RankingsViewProps } from './types';

export const RankingsMobileList = ({
  teams,
  onTeamClick,
}: RankingsViewProps) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label="College football rankings"
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
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: 'center' }}
        >
          <Stack
            sx={{
              alignItems: 'center',
              width: 42,
              flexShrink: 0,
            }}
          >
            <Typography variant="h6">{team.ranking}</Typography>
            {team.movement !== 0 && (
              <Chip
                label={`${team.movement > 0 ? '+' : ''}${team.movement}`}
                size="small"
                color={team.movement > 0 ? 'success' : 'error'}
                variant="outlined"
                aria-label={`${team.movement > 0 ? 'Up' : 'Down'} ${Math.abs(team.movement)} ${Math.abs(team.movement) === 1 ? 'place' : 'places'}`}
              />
            )}
          </Stack>
          <TeamLogo name={team.name} size={36} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              <TeamLink name={team.name} onTeamClick={onTeamClick} />
              {team.isPlayoffTeam && (
                <Chip label="Playoff" size="small" color="primary" variant="outlined" />
              )}
            </Stack>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {team.record}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                lineHeight: 1.2,
              }}
            >
              Poll score
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {team.poll_score.toFixed(1)}
            </Typography>
          </Box>
        </Stack>
      </Box>
    ))}
  </Paper>
);
