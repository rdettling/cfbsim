import { Box, Chip, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { AwardEntry, AwardMode, AwardPlayer, AwardStats, TeamSelectionHandler } from './types';

type AwardDetailProps = {
  award: AwardEntry;
  mode: AwardMode;
  onTeamClick: TeamSelectionHandler;
};

type AwardPlacement = {
  key: 'first' | 'second' | 'third';
  player: AwardPlayer | null;
  score: number | null;
  stats: AwardStats | null;
};

const getPlacements = (award: AwardEntry): AwardPlacement[] => [
  {
    key: 'first',
    player: award.first_place,
    score: award.first_score,
    stats: award.first_stats,
  },
  {
    key: 'second',
    player: award.second_place,
    score: award.second_score,
    stats: award.second_stats,
  },
  {
    key: 'third',
    player: award.third_place,
    score: award.third_score,
    stats: award.third_stats,
  },
];

const getPlacementLabel = (placement: AwardPlacement['key'], mode: AwardMode) => {
  if (mode === 'final') {
    if (placement === 'first') return 'Winner';
    return placement === 'second' ? 'Second Place' : 'Third Place';
  }
  if (placement === 'first') return 'First Favorite';
  return placement === 'second' ? 'Second Favorite' : 'Third Favorite';
};

const ContenderRow = ({
  placement,
  mode,
  onTeamClick,
}: {
  placement: AwardPlacement;
  mode: AwardMode;
  onTeamClick: TeamSelectionHandler;
}) => {
  const { player, score, stats } = placement;
  const isWinner = mode === 'final' && placement.key === 'first' && player !== null;

  return (
    <Paper
      component="article"
      variant="outlined"
      sx={{
        p: { xs: 1.5, md: 2 },
        borderLeft: '3px solid',
        borderLeftColor: isWinner
          ? 'success.main'
          : placement.key === 'first'
            ? 'primary.main'
            : 'divider',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
            }}
          >
            {getPlacementLabel(placement.key, mode)}
          </Typography>
          {player ? (
            <>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{
                  alignItems: 'center',
                  mt: 0.25,
                }}
              >
                <TeamLogo name={player.team_name} size={38} />
                <Box sx={{ minWidth: 0 }}>
                  <MuiLink
                    component={RouterLink}
                    to={`/players/${player.id}`}
                    underline="hover"
                    sx={{ display: 'block', fontSize: '1.1rem', fontWeight: 700 }}
                  >
                    {player.first} {player.last}
                  </MuiLink>
                  <TeamLink name={player.team_name} onTeamClick={onTeamClick} />
                </Box>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 1,
                }}
              >
                {stats?.stat_line ?? 'No stats yet'}
              </Typography>
            </>
          ) : (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="h6">No candidate</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                This placement will populate when an eligible player has recorded statistics.
              </Typography>
            </Box>
          )}
        </Box>

        <Stack
          direction={{ xs: 'row', sm: 'column' }}
          spacing={0.5}
          sx={{
            alignItems: { xs: 'center', sm: 'flex-end' },
          }}
        >
          <Chip label={player?.pos.toUpperCase() ?? '—'} size="small" variant="outlined" />
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              Award Score
            </Typography>
            <Typography variant="h6">{score === null ? '—' : score.toFixed(1)}</Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};

export const AwardDetail = ({ award, mode, onTeamClick }: AwardDetailProps) => {
  const placements = getPlacements(award);
  const hasCandidates = placements.some((placement) => placement.player !== null);

  return (
    <Paper
      component="section"
      aria-labelledby="selected-award-title"
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography id="selected-award-title" component="h2" variant="h5">
              {award.category_name}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {award.category_description}
            </Typography>
          </Box>
          <Chip
            label={mode === 'final' ? 'Final Result' : 'Live Race'}
            color={mode === 'final' ? 'success' : 'primary'}
            variant="outlined"
            size="small"
          />
        </Stack>
      </Box>
      <Stack spacing={1.25} sx={{ p: { xs: 1.5, md: 2 }, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {hasCandidates ? (
          placements.map((placement) => (
            <ContenderRow
              key={placement.key}
              placement={placement}
              mode={mode}
              onTeamClick={onTeamClick}
            />
          ))
        ) : (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="h6">No candidates yet</Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.5,
              }}
            >
              Eligible players will appear after recorded game statistics are available.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
