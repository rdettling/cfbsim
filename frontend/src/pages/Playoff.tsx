import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { CircularProgress, Alert } from '@mui/material';
import Navbar from '../components/Navbar';
import TwelveTeamPlayoff from '../components/TwelveTeamPlayoff';

interface PlayoffTeam extends Team {
    seed?: number;
    ranking: number;
    record: string;
    is_autobid: boolean;
}

interface BubbleTeam extends Team {
    ranking: number;
    record: string;
    team: {
        conference: string;
    };
}

interface ConferenceChampion extends Team {
    ranking: number;
    record: string;
    seed?: number;
    team: {
        conference: string;
    };
}

interface PlayoffData {
    info: Info;
    team: Team;
    conferences: Conference[];
    playoff_teams: PlayoffTeam[];
    bubble_teams: BubbleTeam[];
    conference_champions: ConferenceChampion[];
}

const Playoff = () => {
    const [data, setData] = useState<PlayoffData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlayoff = async () => {
            try {
                setLoading(true);
                const responseData = await apiService.getPlayoff<PlayoffData>();
                setData(responseData);
            } catch (error) {
                setError('Failed to load playoff data');
                console.error('Error fetching playoff:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayoff();
    }, []);

    // Add usePageRefresh for automatic data updates
    usePageRefresh<PlayoffData>(setData);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <TwelveTeamPlayoff
                playoffTeams={data.playoff_teams}
                bubbleTeams={data.bubble_teams}
                conferenceChampions={data.conference_champions}
            />
        </>
    );
};

export default Playoff;
