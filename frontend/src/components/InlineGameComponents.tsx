import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Team } from '../interfaces';
import { TeamLogo, TeamLink } from './TeamComponents';
import { getGameRoute } from '../services/api';

// Common props for both components
interface BaseGameComponentProps {
    team: Team;
    onTeamClick: (name: string) => void;
}

// Common hook for game navigation
const useGameNavigation = () => {
    const navigate = useNavigate();
    
    const handleGameClick = (gameId: string) => {
        navigate(getGameRoute(gameId));
    };
    
    return handleGameClick;
};

// Common component for displaying team info with ranking
const TeamInfo: React.FC<{ 
    teamName: string; 
    ranking: string | number; 
    onTeamClick: (name: string) => void; 
}> = ({ teamName, ranking, onTeamClick }) => (
    <>
        <TeamLogo name={teamName} size={20} />
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            #{ranking}
        </Typography>
        <TeamLink name={teamName} onTeamClick={onTeamClick} />
    </>
);

// Common component for clickable game info
const ClickableGameInfo: React.FC<{
    text: string;
    gameId: string;
    onGameClick: (gameId: string) => void;
}> = ({ text, gameId, onGameClick }) => (
    <Typography
        variant="body2"
        sx={{
            cursor: 'pointer',
            textDecoration: 'underline',
            color: 'primary.main',
            fontWeight: 'bold',
            '&:hover': { color: 'primary.dark' }
        }}
        onClick={() => onGameClick(gameId)}
    >
        {text}
    </Typography>
);

// Last Week Component
export const InlineLastWeek: React.FC<BaseGameComponentProps> = ({ team, onTeamClick }) => {
    const handleGameClick = useGameNavigation();

    return (
        <>
            {team.last_game && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2">
                        {team.last_game.result}
                    </Typography>
                    <ClickableGameInfo 
                        text={`(${team.last_game.score})`}
                        gameId={team.last_game.id}
                        onGameClick={handleGameClick}
                    />
                    <Typography variant="body2">vs</Typography>
                    <TeamInfo 
                        teamName={team.last_game.opponent.name}
                        ranking={team.last_game.opponent.ranking}
                        onTeamClick={onTeamClick}
                    />
                </Box>
            )}
        </>
    );
};

// This Week Component
export const InlineThisWeek: React.FC<BaseGameComponentProps> = ({ team, onTeamClick }) => {
    const handleGameClick = useGameNavigation();

    return (
        <>
            {team.next_game && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <TeamInfo 
                        teamName={team.next_game.opponent.name}
                        ranking={team.next_game.opponent.ranking}
                        onTeamClick={onTeamClick}
                    />
                    <ClickableGameInfo 
                        text={`(${team.next_game.spread})`}
                        gameId={team.next_game.id}
                        onGameClick={handleGameClick}
                    />
                </Box>
            )}
        </>
    );
};
