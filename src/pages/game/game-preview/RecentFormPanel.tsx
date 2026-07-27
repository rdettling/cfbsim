import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../../../components/team/TeamComponents';
import type { Team } from '../../../types/domain';
import type { GamePageData } from '../../../types/pages';

type RecentGame = GamePageData['preview']['teamA']['lastFiveGames'][number];

type RecentFormPanelProps = {
  awayTeam: Team;
  homeTeam: Team;
  awayGames: RecentGame[];
  homeGames: RecentGame[];
};

type TeamRecentFormProps = {
  team: Team;
  games: RecentGame[];
};

const formatLocation = (location: RecentGame['location']) => {
  if (location === 'N') return 'vs (N)';
  return location;
};

const TeamRecentForm = ({ team, games }: TeamRecentFormProps) => (
  <Box sx={{ minWidth: 0 }}>
    <Stack direction="row" spacing={0.75} alignItems="center">
      <TeamLogo name={team.name} size={24} />
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
        {team.name}
      </Typography>
    </Stack>

    {games.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        No completed games yet.
      </Typography>
    ) : (
      <Stack divider={<Divider flexItem />} sx={{ mt: 0.75 }}>
        {games.map((game) => (
          <Box
            key={game.id}
            component={RouterLink}
            to={`/game/${game.id}`}
            aria-label={`Week ${game.week}, ${game.result} against ${game.opponent}, ${game.score}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 0.75,
              py: 0.6,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Typography
                variant="caption"
                color={game.result === 'W' ? 'success.main' : 'error.main'}
                sx={{ fontWeight: 700 }}
              >
                {game.result}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Wk {game.week}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
              <TeamLogo name={game.opponent} size={18} />
              <Typography variant="body2" noWrap>
                {formatLocation(game.location)} {game.opponent}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              {game.score}
            </Typography>
          </Box>
        ))}
      </Stack>
    )}
  </Box>
);

export const RecentFormPanel = ({
  awayTeam,
  homeTeam,
  awayGames,
  homeGames,
}: RecentFormPanelProps) => (
  <Paper component="section" variant="outlined" sx={{ p: 1.5, height: '100%' }}>
    <Typography component="h2" variant="h6">
      Recent Form
    </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
        mt: 1,
      }}
    >
      <TeamRecentForm team={awayTeam} games={awayGames} />
      <Box sx={{ borderLeft: { sm: '1px solid' }, borderColor: 'divider', pl: { sm: 1.5 } }}>
        <TeamRecentForm team={homeTeam} games={homeGames} />
      </Box>
    </Box>
  </Paper>
);
