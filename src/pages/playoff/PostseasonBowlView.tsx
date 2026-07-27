import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamComponents';
import type { BowlGame, GameAction, TeamAction } from './types';

type PostseasonBowlViewProps = {
  games: BowlGame[];
  showingProjections: boolean;
  onGameClick: GameAction;
  onTeamClick: TeamAction;
};

const BowlTeam = ({
  name,
  rank,
  record,
  conference,
  champion,
  score,
  winner,
  onTeamClick,
}: {
  name: string;
  rank: number;
  record: string;
  conference: string;
  champion: boolean;
  score: number | null;
  winner: boolean;
  onTeamClick: TeamAction;
}) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '28px minmax(0, 1fr) auto',
      gap: 0.75,
      alignItems: 'center',
      minWidth: 0,
    }}
  >
    <TeamLogo name={name} size={24} />
    <Box sx={{ minWidth: 0 }}>
      <Button
        size="small"
        onClick={() => onTeamClick(name)}
        sx={{
          minWidth: 0,
          p: 0,
          color: 'text.primary',
          justifyContent: 'flex-start',
          fontWeight: winner ? 700 : 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {rank > 0 ? `#${rank} ` : ''}{name}
      </Button>
      <Typography variant="caption" color="text.secondary" display="block">
        {record} · {conference}
      </Typography>
    </Box>
    <Stack direction="row" spacing={0.5} alignItems="center">
      {champion && (
        <Chip label="Champion" size="small" color="success" variant="outlined" />
      )}
      {score !== null && (
        <Typography variant="body1" sx={{ minWidth: 24, textAlign: 'right', fontWeight: winner ? 700 : 500 }}>
          {score}
        </Typography>
      )}
    </Stack>
  </Box>
);

const BowlRow = ({
  game,
  onGameClick,
  onTeamClick,
}: {
  game: BowlGame;
  onGameClick: GameAction;
  onTeamClick: TeamAction;
}) => (
  <Paper variant="outlined" sx={{ p: 1.25 }}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(150px, 0.8fr) minmax(0, 1fr) auto minmax(0, 1fr)' },
        gap: 1.25,
        alignItems: 'center',
      }}
    >
      <Box>
        <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {game.name}
          </Typography>
          {game.is_ny6 && <Chip label="NY6" size="small" color="primary" variant="outlined" />}
          {game.is_projection && <Chip label="Projection" size="small" variant="outlined" />}
        </Stack>
        {game.id > 0 && (
          <Button size="small" onClick={() => onGameClick(game.id)} sx={{ mt: 0.25, p: 0 }}>
            View game
          </Button>
        )}
      </Box>
      <BowlTeam
        name={game.teamA}
        rank={game.rankA}
        record={game.recordA}
        conference={game.teamA_conf}
        champion={game.teamA_is_champ}
        score={game.scoreA}
        winner={game.winner === game.teamA}
        onTeamClick={onTeamClick}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textAlign: 'center', display: { xs: 'none', md: 'block' } }}
      >
        VS
      </Typography>
      <BowlTeam
        name={game.teamB}
        rank={game.rankB}
        record={game.recordB}
        conference={game.teamB_conf}
        champion={game.teamB_is_champ}
        score={game.scoreB}
        winner={game.winner === game.teamB}
        onTeamClick={onTeamClick}
      />
    </Box>
  </Paper>
);

const BowlSection = ({
  title,
  games,
  onGameClick,
  onTeamClick,
}: {
  title: string;
  games: BowlGame[];
  onGameClick: GameAction;
  onTeamClick: TeamAction;
}) => (
  <Box component="section" aria-label={title}>
    <Typography
      component="h2"
      variant="overline"
      color="text.secondary"
      sx={{ display: 'block', mb: 0.75, letterSpacing: 1 }}
    >
      {title}
    </Typography>
    <Stack spacing={0.75}>
      {games.map((game) => (
        <BowlRow
          key={`${game.id}-${game.name}`}
          game={game}
          onGameClick={onGameClick}
          onTeamClick={onTeamClick}
        />
      ))}
    </Stack>
  </Box>
);

export const PostseasonBowlView = ({
  games,
  showingProjections,
  onGameClick,
  onTeamClick,
}: PostseasonBowlViewProps) => {
  if (games.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">No bowl slate available</Typography>
        <Typography variant="body2" color="text.secondary">
          Bowl matchups will appear when eligible teams are available.
        </Typography>
      </Paper>
    );
  }

  const ny6Games = games.filter((game) => game.is_ny6);
  const otherGames = games.filter((game) => !game.is_ny6);

  return (
    <Paper
      component="section"
      aria-label="Bowl slate"
      variant="outlined"
      sx={{
        p: 1.5,
        flex: { lg: 1 },
        minHeight: { lg: 0 },
        overflow: { lg: 'auto' },
      }}
    >
      <Box sx={{ mb: 1.25 }}>
        <Typography component="h2" variant="h6">
          {showingProjections ? 'Projected Bowl Slate' : 'Bowl Slate'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {showingProjections
            ? 'Projected pairings based on the current field and bowl rotation.'
            : 'Scheduled postseason games and completed results.'}
        </Typography>
      </Box>
      <Stack spacing={1.5}>
        {ny6Games.length > 0 && (
          <BowlSection
            title="New Year’s Six"
            games={ny6Games}
            onGameClick={onGameClick}
            onTeamClick={onTeamClick}
          />
        )}
        {otherGames.length > 0 && (
          <BowlSection
            title="Other Bowls"
            games={otherGames}
            onGameClick={onGameClick}
            onTeamClick={onTeamClick}
          />
        )}
      </Stack>
    </Paper>
  );
};
