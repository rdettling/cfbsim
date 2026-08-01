import StarIcon from '@mui/icons-material/Star';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLink } from '../../components/team/TeamLink';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { PlayerPageData } from '../../types/pages';

type PlayerProfileProps = {
  player: PlayerPageData['player'];
  awards: PlayerPageData['awards'];
  teamColor: string;
  onTeamClick: (teamName: string) => void;
};

const classLabels = {
  fr: 'Freshman',
  so: 'Sophomore',
  jr: 'Junior',
  sr: 'Senior',
} as const;

export const PlayerProfile = ({ player, awards, teamColor, onTeamClick }: PlayerProfileProps) => (
  <Paper
    component="header"
    variant="outlined"
    sx={{
      mb: 1.5,
      p: { xs: 1.5, md: 2 },
      borderLeft: '3px solid',
      borderLeftColor: teamColor || 'primary.main',
    }}
  >
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" variant="h4">
          {player.first} {player.last}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            mt: 1,
          }}
        >
          <TeamLogo name={player.team} size={32} />
          <TeamLink name={player.team} onTeamClick={onTeamClick} />
        </Stack>
      </Box>
      <Box sx={{ textAlign: { xs: 'left', md: 'right' }, flexShrink: 0 }}>
        <Typography variant="h3">{player.rating}</Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          Overall rating
        </Typography>
      </Box>
    </Stack>

    <Stack
      direction="row"
      useFlexGap
      spacing={0.75}
      sx={{
        flexWrap: 'wrap',
        mt: 1.5,
      }}
    >
      <Chip label={player.pos.toUpperCase()} size="small" variant="outlined" />
      <Chip label={classLabels[player.year]} size="small" variant="outlined" />
      <Chip
        icon={<StarIcon />}
        label={player.stars > 0 ? `${player.stars} stars` : 'Unrated recruit'}
        size="small"
        color="warning"
        variant="outlined"
      />
      <Chip label={`Development ${player.development_trait}`} size="small" variant="outlined" />
      <Chip
        label={player.starter ? 'Starter' : 'Backup'}
        size="small"
        color={player.starter ? 'success' : 'default'}
        variant="outlined"
      />
    </Stack>

    {awards.length > 0 && (
      <Stack
        direction="row"
        useFlexGap
        spacing={0.75}
        sx={{
          flexWrap: 'wrap',
          mt: 1.5,
        }}
      >
        {awards.map((award) => (
          <Chip
            key={award.slug}
            label={award.name}
            size="small"
            color="primary"
            variant="outlined"
          />
        ))}
      </Stack>
    )}
  </Paper>
);
