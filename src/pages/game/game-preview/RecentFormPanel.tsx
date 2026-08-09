import { Box, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { TeamLogo } from '../../../components/team/TeamLogo';
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

    {games.length === 0 ? (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mt: 1,
        }}
      >
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
            <Stack
              direction="row"
              spacing={0.6}
              sx={{
                alignItems: 'center',
              }}
            >
              <Typography
                variant="caption"
                color={game.result === 'W' ? 'success.main' : 'error.main'}
                sx={{ fontWeight: 700 }}
              >
                {game.result}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Wk {game.week}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={0.6}
              sx={{
                alignItems: 'center',
                minWidth: 0,
              }}
            >
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
  <Box>
    <TeamRecentForm team={awayTeam} games={awayGames} />
    <Divider sx={{ my: 1.25 }} />
    <TeamRecentForm team={homeTeam} games={homeGames} />
  </Box>
);
