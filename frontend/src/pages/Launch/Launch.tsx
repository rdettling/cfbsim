import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Container, Typography, Button, Paper } from '@mui/material';

interface LaunchProps {
    years: string[];
    info: {
        currentYear: number;
        team?: {
            name: string;
        };
    } | null;
}

const Launch = () => {
    const [data, setData] = useState<LaunchProps>({ years: [], info: null });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:8000/api/launch/');
                setData(response.data);
            } catch (error) {
                console.error('Error fetching launch data:', error);
            }
        };

        fetchData();
    }, []);

    return (
        <Container maxWidth="md">
            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h2" component="h1" gutterBottom>
                    CFBSim.net
                </Typography>

                {data.info?.team ? (
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            Continue {data.info.currentYear} Season
                        </Typography>
                        <Typography variant="subtitle1" gutterBottom>
                            {data.info.team.name}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            href="/dashboard"
                            sx={{ mt: 2 }}
                        >
                            Continue
                        </Button>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            Start New Season
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                            {data.years.map((year) => (
                                <Button
                                    key={year}
                                    variant="outlined"
                                    href={`/preview?year=${year}`}
                                >
                                    {year}
                                </Button>
                            ))}
                        </Box>
                    </Paper>
                )}
            </Box>
        </Container>
    );
};

export default Launch;