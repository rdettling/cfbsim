import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { GamePreviewData } from '../interfaces';
import {
    Button,
    CircularProgress,
    Alert,
    Box,
} from '@mui/material';
import Navbar from '../components/Navbar';
import GamePreview from '../components/GamePreview';
import GameResult from '../components/GameResult';
import { useParams, useNavigate } from 'react-router-dom';

const Game = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<GamePreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGame = async () => {
            try {
                setLoading(true);
                const responseData = await apiService.getGame<GamePreviewData>(id!);
                setData(responseData);
            } catch (error) {
                setError('Failed to load game data');
                console.error('Error fetching game:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchGame();
        }
    }, [id]);

    useEffect(() => {
        if (data?.game) {
            document.title = `${data.game.teamA.name} vs ${data.game.teamB.name}`;
        }
        return () => {
            document.title = 'College Football';
        };
    }, [data?.game]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    return (
        <>
            <Navbar
                team={data.info.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            
            {data.game.winner ? (
                <GameResult data={data} />
            ) : (
                <GamePreview game={data.game} top_players={data.top_players} />
            )}
        </>
    );
};

export default Game;