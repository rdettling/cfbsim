import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { CircularProgress, Alert, Container, Typography } from '@mui/material';
import Navbar from '../components/Navbar';
import ChampionshipPlayoff from '../components/ChampionshipPlayoff';
import FourTeamPlayoff from '../components/FourTeamPlayoff';
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
    conference: string;
}

interface ConferenceChampion extends Team {
    ranking: number;
    record: string;
    seed?: number;
    conference: string;
}

interface PlayoffData {
    info: Info & {
        playoff?: {
            teams: number;
            autobids: number;
            conf_champ_top_4: boolean;
        };
    };
    team: Team;
    conferences: Conference[];
    playoff_teams: PlayoffTeam[];
    bubble_teams: BubbleTeam[];
    conference_champions: ConferenceChampion[];
    bracket: any;
}

// Helper function to get playoff format name
const getPlayoffFormatName = (teams: number) => {
    switch (teams) {
        case 2: return 'Championship';
        case 4: return '4-Team Playoff';
        case 12: return '12-Team Playoff';
        default: return `${teams}-Team Playoff`;
    }
};

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

    const playoffFormat = data.info.playoff?.teams || 4;
    const formatName = getPlayoffFormatName(playoffFormat);

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            
            <Container maxWidth="xl" sx={{ mt: 2 }}>
                <Typography variant="h3" align="center" sx={{ mb: 3 }}>
                    {formatName} {data.info.stage === 'playoff' ? '' : 'Projection'}
                </Typography>

                {playoffFormat === 2 && (
                    <ChampionshipPlayoff
                        playoffTeams={data.playoff_teams}
                        bubbleTeams={data.bubble_teams}
                        conferenceChampions={data.conference_champions}
                    />
                )}

                {playoffFormat === 4 && (
                    <FourTeamPlayoff
                        playoffTeams={data.playoff_teams}
                        bubbleTeams={data.bubble_teams}
                        conferenceChampions={data.conference_champions}
                    />
                )}

                {playoffFormat === 12 && (
                    <TwelveTeamPlayoff
                        playoffTeams={data.playoff_teams}
                        bubbleTeams={data.bubble_teams}
                        conferenceChampions={data.conference_champions}
                        bracket={data.bracket}
                    />
                )}
            </Container>
        </>
    );
};

export default Playoff;
