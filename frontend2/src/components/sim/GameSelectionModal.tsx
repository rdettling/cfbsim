import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemButton,
    Box,
    Typography,
    CircularProgress,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TeamLogo } from '../team/TeamComponents';
import { getGamesToLiveSim } from '../../domain/sim';

interface Game {
    id: number;
    teamA: {
        name: string;
        ranking: number;
        record: string;
    };
    teamB: {
        name: string;
        ranking: number;
        record: string;
    };
    label: string;
    watchability: number;
    is_user_game?: boolean;
}

interface GameSelectionModalProps {
    open: boolean;
    onClose: () => void;
    onGameSelect: (gameId: number, isUserGame: boolean) => void;
}

const GameSelectionModal = ({ open, onClose, onGameSelect }: GameSelectionModalProps) => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [week, setWeek] = useState<number>(0);

    useEffect(() => {
        if (open) {
            fetchGames();
        }
    }, [open]);

    const fetchGames = async () => {
        setLoading(true);
        try {
            const response = await getGamesToLiveSim();
            setGames(response.games);
            setWeek(response.week);
        } catch (error) {
            console.error('Error fetching games:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGameClick = (game: Game) => {
        onGameSelect(game.id, game.is_user_game || false);
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
                pb: 2
            }}>
                <Box component="span" sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    Select Game to Simulate - Week {week}
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : games.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                            No games available to simulate this week
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 0 }}>
                        {games.map((game, index) => (
                            <ListItem 
                                key={game.id} 
                                disablePadding
                                sx={{
                                    borderBottom: index < games.length - 1 ? '1px solid' : 'none',
                                    borderColor: 'divider',
                                    ...(game.is_user_game && {
                                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                        borderLeft: '4px solid',
                                        borderLeftColor: 'primary.main',
                                    })
                                }}
                            >
                                <ListItemButton 
                                    onClick={() => handleGameClick(game)}
                                    sx={{
                                        py: 2,
                                        px: 3,
                                        '&:hover': {
                                            backgroundColor: game.is_user_game 
                                                ? 'rgba(25, 118, 210, 0.12)' 
                                                : 'rgba(46, 125, 50, 0.04)'
                                        }
                                    }}
                                >
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        width: '100%',
                                        gap: 3
                                    }}>
                                        {/* Team A */}
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            flex: 1,
                                            justifyContent: 'flex-end',
                                            gap: 2
                                        }}>
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="h6" fontWeight="bold">
                                                    {game.teamA.ranking > 0 && `#${game.teamA.ranking} `}
                                                    {game.teamA.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {game.teamA.record}
                                                </Typography>
                                            </Box>
                                            <TeamLogo name={game.teamA.name} size={50} />
                                        </Box>

                                        {/* VS divider */}
                                        <Box sx={{ 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            minWidth: 80
                                        }}>
                                            <Typography 
                                                variant="body2" 
                                                fontWeight="bold" 
                                                color={game.is_user_game ? 'primary.main' : 'text.secondary'}
                                            >
                                                {game.is_user_game ? 'YOUR GAME' : 'VS'}
                                            </Typography>
                                            {!game.is_user_game && (
                                                <Typography 
                                                    variant="caption" 
                                                    color="success.main"
                                                    fontWeight="bold"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {game.watchability}
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Team B */}
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            flex: 1,
                                            gap: 2
                                        }}>
                                            <TeamLogo name={game.teamB.name} size={50} />
                                            <Box>
                                                <Typography variant="h6" fontWeight="bold">
                                                    {game.teamB.ranking > 0 && `#${game.teamB.ranking} `}
                                                    {game.teamB.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {game.teamB.record}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default GameSelectionModal;
