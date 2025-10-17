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
import { TeamLogo } from './TeamComponents';
import { apiService } from '../services/api';

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
    spread: string;
}

interface GameSelectionModalProps {
    open: boolean;
    onClose: () => void;
    onGameSelect: (gameId: number) => void;
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
            const response = await apiService.getLiveSimGames() as any;
            setGames(response.games);
            setWeek(response.week);
        } catch (error) {
            console.error('Error fetching games:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGameClick = (gameId: number) => {
        onGameSelect(gameId);
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
                <Typography variant="h5" fontWeight="bold">
                    Select Game to Simulate - Week {week}
                </Typography>
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
                                    borderColor: 'divider'
                                }}
                            >
                                <ListItemButton 
                                    onClick={() => handleGameClick(game.id)}
                                    sx={{
                                        py: 2,
                                        px: 3,
                                        '&:hover': {
                                            backgroundColor: 'rgba(46, 125, 50, 0.04)'
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
                                                color="text.secondary"
                                            >
                                                VS
                                            </Typography>
                                            <Typography 
                                                variant="caption" 
                                                color="text.secondary"
                                                sx={{ mt: 0.5 }}
                                            >
                                                {game.spread}
                                            </Typography>
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

