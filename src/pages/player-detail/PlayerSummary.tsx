import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import { PLAYER_YEAR_LABELS } from '../../constants/player';
import type { PlayerPageData } from '../../types/pages';
import { PlayerOriginSummary } from './PlayerOriginSummary';
import { PlayerStarRating } from './PlayerStarRating';

type PlayerSummaryProps = {
  player: PlayerPageData['player'];
  awards: PlayerPageData['awards'];
  origin: PlayerPageData['origin'];
  teamColor: string;
  onTeamClick: (teamName: string) => void;
};

export const PlayerSummary = ({
  player,
  awards,
  origin,
  teamColor,
  onTeamClick,
}: PlayerSummaryProps) => (
  <Paper
    component="header"
    variant="outlined"
    aria-labelledby="player-name-heading"
    sx={{
      flexShrink: 0,
      px: { xs: 1.5, sm: 2 },
      py: { xs: 1.5, lg: 1.25 },
      borderLeft: '3px solid',
      borderLeftColor: teamColor || 'primary.main',
      display: 'grid',
      gridTemplateColumns: {
        xs: 'minmax(0, 1fr) auto',
        lg: 'minmax(280px, 340px) minmax(120px, 150px) 210px minmax(0, 1fr) 88px',
      },
      gridTemplateAreas: {
        xs:
          awards.length > 0
            ? '"identity overall" "profile profile" "ratings ratings" "origin origin" "awards awards"'
            : '"identity overall" "profile profile" "ratings ratings" "origin origin"',
        lg:
          awards.length > 0
            ? '"identity profile ratings . overall" "identity origin origin origin overall" "identity awards awards awards overall"'
            : '"identity profile ratings . overall" "identity origin origin origin overall"',
      },
      columnGap: { xs: 1.5, lg: 2 },
      rowGap: { xs: 1, lg: 0.35 },
      alignItems: { xs: 'start', lg: 'center' },
      minWidth: 0,
    }}
  >
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ gridArea: 'identity', alignItems: 'center', minWidth: 0 }}
    >
      <Box sx={{ display: { xs: 'block', lg: 'none' }, flexShrink: 0 }}>
        <TeamLogo name={player.team} size={44} />
      </Box>
      <Box sx={{ display: { xs: 'none', lg: 'block' }, flexShrink: 0 }}>
        <TeamLogo name={player.team} size={52} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          id="player-name-heading"
          component="h1"
          variant="h4"
          sx={{
            fontSize: { xs: '1.45rem', sm: '1.6rem', lg: '1.7rem' },
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={`${player.first} ${player.last}`}
        >
          {player.first} {player.last}
        </Typography>
        <Box sx={{ mt: 0.35 }}>
          <TeamLink name={player.team} onTeamClick={onTeamClick} />
        </Box>
      </Box>
    </Stack>

    <Stack
      direction={{ xs: 'row', lg: 'column' }}
      useFlexGap
      spacing={{ xs: 0.75, lg: 0.45 }}
      sx={{
        gridArea: 'profile',
        minWidth: 0,
        alignItems: { xs: 'center', lg: 'flex-start' },
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', flexShrink: 0 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {player.pos.toUpperCase()}
        </Typography>
        <Typography variant="body2" color="text.secondary" aria-hidden="true">
          ·
        </Typography>
        <Typography variant="body2">{PLAYER_YEAR_LABELS[player.year]}</Typography>
      </Stack>
      <Chip
        label={player.starter ? 'Starter' : 'Backup'}
        size="small"
        color={player.starter ? 'success' : 'default'}
        variant="outlined"
      />
    </Stack>

    <Stack spacing={0.15} sx={{ gridArea: 'ratings', minWidth: 0 }}>
      <PlayerStarRating label="Recruiting" value={player.stars} />
      <PlayerStarRating label="Development" value={player.development_trait} />
    </Stack>

    <Typography
      component="div"
      variant="body2"
      sx={{
        gridArea: 'origin',
        minWidth: 0,
        color: 'text.secondary',
        fontSize: { lg: '0.78rem' },
        lineHeight: 1.4,
      }}
    >
      <Box
        component="span"
        sx={{
          mr: 0.75,
          color: 'text.primary',
          fontSize: '0.67rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Origin
      </Box>
      <PlayerOriginSummary origin={origin} onTeamClick={onTeamClick} />
    </Typography>

    {awards.length > 0 && (
      <Stack
        component="div"
        role="list"
        aria-label="Player awards"
        direction="row"
        spacing={0.75}
        sx={{
          gridArea: 'awards',
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 0.25,
          scrollbarWidth: 'thin',
        }}
      >
        {awards.map((award, index) => (
          <Box key={`${award.slug}-${index}`} role="listitem" sx={{ flexShrink: 0 }}>
            <Chip label={award.name} size="small" color="primary" variant="outlined" />
          </Box>
        ))}
      </Stack>
    )}

    <Box
      aria-label={`Overall rating ${player.rating}`}
      sx={{
        gridArea: 'overall',
        textAlign: 'right',
        flexShrink: 0,
        alignSelf: 'center',
        pt: { xs: 0.1, lg: 0 },
      }}
    >
      <Typography sx={{ fontSize: { xs: '2rem', lg: '2.35rem' }, fontWeight: 600, lineHeight: 1 }}>
        {player.rating}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
        OVR
      </Typography>
    </Box>
  </Paper>
);
