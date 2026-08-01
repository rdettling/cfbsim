import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
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

type TeamStartersProps = {
  team: Team;
  starters: Starter[];
};

const TeamStarters = ({ team, starters }: TeamStartersProps) => (
  <Box sx={{ minWidth: 0 }}>
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: 'center',
      }}
    >
      <TeamLogo name={team.name} size={24} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
        {team.name}
      </Typography>
    </Stack>

    {starters.length === 0 ? (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mt: 1,
        }}
      >
        No eligible starters are available.
      </Typography>
    ) : (
      <Stack divider={<Divider flexItem />} sx={{ mt: 0.75 }}>
        {starters.map((player) => (
          <Box
            key={player.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 0.75,
              py: 0.6,
            }}
          >
            <Chip
              label={player.pos}
              size="small"
              variant="outlined"
              sx={{ height: 22, minWidth: 38, fontSize: '0.7rem' }}
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
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
              }}
            >
              {player.rating}
            </Typography>
          </Box>
        ))}
      </Stack>
    )}
  </Box>
);

export const TopStartersPanel = ({
  awayTeam,
  homeTeam,
  awayStarters,
  homeStarters,
}: TopStartersPanelProps) => (
  <Paper component="section" variant="outlined" sx={{ p: 1.5, height: '100%' }}>
    <Typography component="h2" variant="h6">
      Top Starters
    </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
        mt: 1,
      }}
    >
      <TeamStarters team={awayTeam} starters={awayStarters} />
      <Box sx={{ borderLeft: { sm: '1px solid' }, borderColor: 'divider', pl: { sm: 1.5 } }}>
        <TeamStarters team={homeTeam} starters={homeStarters} />
      </Box>
    </Box>
  </Paper>
);
