import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { BowlGameEntry, BowlTeamEntry } from '../../types/postseason';

type PostseasonBowlViewProps = {
  games: BowlGameEntry[];
  onGameClick: (gameId: number) => void;
  onTeamClick: (teamName: string) => void;
};

const statusLabels: Record<BowlGameEntry['status'], string> = {
  projected: 'Projected',
  scheduled: 'Scheduled',
  final: 'Final',
};

const BowlTeam = ({
  team,
  onTeamClick,
}: {
  team: BowlTeamEntry;
  onTeamClick: (teamName: string) => void;
}) => (
  <Box
    aria-label={team.isWinner ? `${team.name} winner` : undefined}
    sx={{
      display: 'grid',
      gridTemplateColumns: '50px minmax(0, 1fr) auto',
      gap: 0.75,
      alignItems: 'center',
      minWidth: 0,
      minHeight: 48,
      px: 1,
      py: 0.75,
      borderLeft: '3px solid',
      borderLeftColor: team.isWinner ? 'primary.main' : 'transparent',
      bgcolor: team.isWinner ? 'action.selected' : 'transparent',
    }}
  >
    <Box sx={{ width: 48, display: 'flex', justifyContent: 'center' }}>
      <TeamLogo name={team.name} size={24} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Button
          size="small"
          onClick={() => onTeamClick(team.name)}
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            p: 0,
            color: 'text.primary',
            justifyContent: 'flex-start',
            fontWeight: team.isWinner ? 700 : 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {team.ranking !== null ? `#${team.ranking} ` : ''}
          {team.name}
        </Button>
        {team.spread && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}
          >
            {team.spread}
          </Typography>
        )}
      </Stack>
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap', lineHeight: 1.25 }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 'inherit' }}>
          {team.record} · {team.conference}
        </Typography>
        {team.isConferenceChampion && (
          <Typography
            variant="caption"
            sx={{ color: 'success.main', fontWeight: 600, lineHeight: 'inherit' }}
          >
            · Conference champ
          </Typography>
        )}
      </Stack>
    </Box>
    {team.score !== null && (
      <Typography
        variant="body1"
        sx={{ minWidth: 28, textAlign: 'right', fontWeight: team.isWinner ? 700 : 500 }}
      >
        {team.score}
      </Typography>
    )}
  </Box>
);

const BowlMatchup = ({
  game,
  onGameClick,
  onTeamClick,
}: {
  game: BowlGameEntry;
  onGameClick: (gameId: number) => void;
  onTeamClick: (teamName: string) => void;
}) => {
  const [teamA, teamB] = game.teams;

  return (
    <Paper
      component="article"
      aria-label={`${game.name}: ${teamA.name} versus ${teamB.name}`}
      variant="outlined"
      sx={{ overflow: 'hidden', minWidth: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          minHeight: 36,
          px: 1,
          py: 0.5,
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {game.gameId !== null ? (
          <Button
            size="small"
            endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
            onClick={() => {
              if (game.gameId !== null) onGameClick(game.gameId);
            }}
            aria-label={`Open ${game.name}`}
            sx={{
              minWidth: 0,
              maxWidth: '100%',
              p: 0,
              color: 'text.primary',
              fontWeight: 700,
              justifyContent: 'flex-start',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {game.name}
          </Button>
        ) : (
          <Typography
            variant="body2"
            sx={{ minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {game.name}
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}
        >
          {statusLabels[game.status]}
        </Typography>
      </Box>
      <BowlTeam team={teamA} onTeamClick={onTeamClick} />
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />
      <BowlTeam team={teamB} onTeamClick={onTeamClick} />
    </Paper>
  );
};

export const PostseasonBowlView = ({
  games,
  onGameClick,
  onTeamClick,
}: PostseasonBowlViewProps) => {
  if (games.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">No bowl slate available</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Bowl matchups will appear when eligible teams are available.
        </Typography>
      </Paper>
    );
  }

  const bestTeamRank = (game: BowlGameEntry) => Math.min(
    ...game.teams.map(team => team.ranking ?? Number.POSITIVE_INFINITY),
  );
  const byBestTeam = (left: BowlGameEntry, right: BowlGameEntry) =>
    bestTeamRank(left) - bestTeamRank(right) || left.name.localeCompare(right.name);
  const orderedGames = [
    ...games.filter(game => game.tier === 'playoff').sort(byBestTeam),
    ...games.filter(game => game.tier === 'ny6').sort(byBestTeam),
    ...games.filter(game => game.tier === 'other').sort(byBestTeam),
  ];

  return (
    <Paper
      component="section"
      aria-label="Bowl slate"
      variant="outlined"
      sx={{
        p: 1.25,
        flex: { lg: 1 },
        minHeight: { lg: 0 },
        overflow: { lg: 'auto' },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 0.75,
        }}
      >
        {orderedGames.map(game => (
          <BowlMatchup
            key={`${game.gameId ?? 'projected'}-${game.name}-${game.teams[0].name}`}
            game={game}
            onGameClick={onGameClick}
            onTeamClick={onTeamClick}
          />
        ))}
      </Box>
    </Paper>
  );
};
