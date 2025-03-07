import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Box,
    Tabs,
    Tab,
    CircularProgress,
    Alert
} from '@mui/material';
import Navbar from '../components/Navbar';
import RushingStats from '../components/RushingStats';
import PassingStats from '../components/PassingStats';
import ReceivingStats from '../components/ReceivingStats';

interface IndividualStatsData {
    info: Info;
    team: Team;
    conferences: Conference[];
    stats: {
        rushing: Record<string, RushingStats>;
        passing: Record<string, PassingStats>;
        receiving: Record<string, ReceivingStats>;
    };
}

const INDIVIDUAL_STATS_URL = `${API_BASE_URL}/api/individual_stats`;

const IndividualStats = () => {
    const [data, setData] = useState<IndividualStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await axios.get(INDIVIDUAL_STATS_URL);
                setData(response.data);
            } catch (error) {
                setError('Failed to load individual stats');
                console.error('Error fetching individual stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    useEffect(() => {
        document.title = 'Individual Stats';
        return () => {
            document.title = 'College Football';
        };
    }, []);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

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
            <Container>
                <Typography variant="h3" align="center" gutterBottom>
                    Individual Stats
                </Typography>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabValue} onChange={handleTabChange} centered>
                        <Tab label="Rushing" />
                        <Tab label="Passing" />
                        <Tab label="Receiving" />
                    </Tabs>
                </Box>

                <Box hidden={tabValue !== 0}>
                    <RushingStats stats={data.stats.rushing} />
                </Box>
                <Box hidden={tabValue !== 1}>
                    <PassingStats stats={data.stats.passing} />
                </Box>
                <Box hidden={tabValue !== 2}>
                    <ReceivingStats stats={data.stats.receiving} />
                </Box>
            </Container>
        </>
    );
};

export default IndividualStats;
