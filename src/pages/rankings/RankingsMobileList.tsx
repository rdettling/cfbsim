import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { CompactGameSummary } from '../../components/game/CompactGameSummary';
import { TeamLink, TeamLogo } from '../../components/team/TeamComponents';
import type { RankingsViewProps } from './types';

export const RankingsMobileList = ({ teams, onTeamClick }: RankingsViewProps) => (
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
          sx={{
            alignItems: 'center',
          }}
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
            <TeamLink name={team.name} onTeamClick={onTeamClick} />
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {team.record}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            mt: 1.5,
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Poll score
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {team.poll_score !== undefined ? team.poll_score.toFixed(1) : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Strength of record
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {team.strength_of_record !== undefined ? team.strength_of_record.toFixed(1) : '—'}
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                mb: 0.25,
              }}
            >
              Last week
            </Typography>
            <CompactGameSummary
              game={team.last_game}
              mode="previous"
              onOpponentClick={onTeamClick}
            />
          </Box>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                mb: 0.25,
              }}
            >
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
