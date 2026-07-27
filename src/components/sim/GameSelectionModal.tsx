import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { getGamesToLiveSim } from '../../domain/sim';
import { resolveHomeAway } from '../../domain/utils/gameDisplay';
import { TeamLogo } from '../team/TeamComponents';

type GameSelectionData = Awaited<ReturnType<typeof getGamesToLiveSim>>;
type GameSelectionRecord = GameSelectionData['games'][number];

type GameSelectionModalProps = {
  open: boolean;
  onClose: () => void;
  onGameSelect: (gameId: number) => void;
};

const TeamSummary = ({
  team,
  align,
}: {
  team: GameSelectionRecord['teamA'];
  align: 'left' | 'right';
}) => (
  <Stack
    direction={align === 'left' ? 'row-reverse' : 'row'}
    spacing={1}
    sx={{
      alignItems: 'center',
      minWidth: 0,
      flex: 1,
    }}
  >
    <TeamLogo name={team.name} size={40} />
    <Box sx={{ minWidth: 0, textAlign: align }}>
      <Typography
        variant="subtitle2"
        title={team.name}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {team.ranking > 0 && `#${team.ranking} `}
        {team.name}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {team.record}
      </Typography>
    </Box>
  </Stack>
);

const GameSelectionModal = ({ open, onClose, onGameSelect }: GameSelectionModalProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState<GameSelectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getGamesToLiveSim());
    } catch (loadError) {
      setError(
        loadError instanceof Error && loadError.message
          ? loadError.message
          : 'Games could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadGames();
  }, [loadGames, open]);

  const handleGameSelect = (gameId: number) => {
    onGameSelect(gameId);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby="game-selection-title"
      slotProps={{
        paper: {
          variant: 'outlined',
          sx: { maxHeight: fullScreen ? '100%' : 'min(760px, 88vh)' },
        },
      }}
    >
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1.5,
          px: 3,
        }}
      >
        <Box>
          <DialogTitle id="game-selection-title" sx={{ p: 0 }}>
            Select a game
          </DialogTitle>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {data ? `Week ${data.week}` : 'Current week'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close game selection">
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Stack
            spacing={1.5}
            sx={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 280,
            }}
          >
            <CircularProgress size={32} />
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              Loading available games…
            </Typography>
          </Stack>
        ) : error ? (
          <Stack spacing={2} sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
            <Button
              variant="outlined"
              onClick={() => void loadGames()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Try Again
            </Button>
          </Stack>
        ) : !data || data.games.length === 0 ? (
          <Stack
            spacing={0.5}
            sx={{
              alignItems: 'center',
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h6">No games available</Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              Every game in this week has already been completed.
            </Typography>
          </Stack>
        ) : (
          <List disablePadding aria-label={`Week ${data.week} games`}>
            {data.games.map((game, index) => {
              const { home, away, neutral } = resolveHomeAway({
                teamA: { id: game.teamAId, name: game.teamA.name },
                teamB: { id: game.teamBId, name: game.teamB.name },
                homeTeamId: game.homeTeamId ?? null,
                awayTeamId: game.awayTeamId ?? null,
                neutralSite: game.neutralSite ?? false,
              });
              const awayTeam = away.id === game.teamAId ? game.teamA : game.teamB;
              const homeTeam = home.id === game.teamAId ? game.teamA : game.teamB;

              return (
                <ListItem
                  key={game.id}
                  disablePadding
                  divider={index < data.games.length - 1}
                  sx={{
                    borderLeft: '3px solid',
                    borderLeftColor: game.is_user_game ? 'primary.main' : 'transparent',
                    backgroundColor: game.is_user_game ? 'action.selected' : 'background.paper',
                  }}
                >
                  <ListItemButton
                    onClick={() => handleGameSelect(game.id)}
                    aria-label={`Simulate ${awayTeam.name} ${neutral ? 'versus' : 'at'} ${homeTeam.name}`}
                    sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5 }}
                  >
                    <Stack spacing={1} sx={{ width: '100%', minWidth: 0 }}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                          alignItems: 'center',
                          gap: { xs: 1, sm: 2 },
                        }}
                      >
                        <TeamSummary team={awayTeam} align="right" />
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 700,
                          }}
                        >
                          {neutral ? 'VS' : 'AT'}
                        </Typography>
                        <TeamSummary team={homeTeam} align="left" />
                      </Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {game.is_user_game ? (
                          <Chip label="Your game · Coaching enabled" size="small" color="primary" />
                        ) : (
                          <Chip
                            label={`Watchability ${game.watchability}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {game.label && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {game.label}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GameSelectionModal;
