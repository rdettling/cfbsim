import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../../../components/team/TeamLogo';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';

type Starter = GamePageData['preview']['teamA']['topStarters'][number];

type TopStartersPanelProps = {
  awayTeam: Team;
  homeTeam: Team;
  awayStarters: Starter[];
  homeStarters: Starter[];
};

type TeamHeaderProps = {
  team: Team;
};

const TeamHeader = ({ team }: TeamHeaderProps) => (
  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
    <TeamLogo name={team.name} size={24} />
    <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
      {team.name}
    </Typography>
  </Stack>
);

type StarterCellProps = {
  player: Starter | undefined;
  showEmptyState: boolean;
};

const StarterCell = ({ player, showEmptyState }: StarterCellProps) => {
  if (!player) {
    if (showEmptyState) {
      return (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          No eligible starters are available.
        </Typography>
      );
    }

    return <Box aria-hidden="true" />;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Chip
        label={player.pos}
        size="small"
        variant="outlined"
        sx={{ height: 22, minWidth: 34, fontSize: '0.7rem', px: 0 }}
      />
      <Typography
        component={RouterLink}
        to={`/players/${player.id}`}
        variant="body2"
        noWrap
        sx={{
          color: 'text.primary',
          fontWeight: 600,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {player.first} {player.last}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {player.rating}
      </Typography>
    </Box>
  );
};

export const TopStartersPanel = ({
  awayTeam,
  homeTeam,
  awayStarters,
  homeStarters,
}: TopStartersPanelProps) => (
  <Box sx={{ minWidth: 0 }}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 1.5,
      }}
    >
      <TeamHeader team={awayTeam} />
      <TeamHeader team={homeTeam} />
    </Box>
    <Stack divider={<Divider flexItem />} sx={{ mt: 0.75 }}>
      {Array.from(
        { length: Math.max(awayStarters.length, homeStarters.length, 1) },
        (_, index) => (
          <Box
            key={index}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              alignItems: 'center',
              columnGap: 1.5,
              py: 0.6,
              minWidth: 0,
            }}
          >
            <StarterCell
              player={awayStarters[index]}
              showEmptyState={index === 0 && awayStarters.length === 0}
            />
            <StarterCell
              player={homeStarters[index]}
              showEmptyState={index === 0 && homeStarters.length === 0}
            />
          </Box>
        ),
      )}
    </Stack>
  </Box>
);
