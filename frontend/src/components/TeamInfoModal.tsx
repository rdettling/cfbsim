import { Modal, Box, Typography, Link } from '@mui/material';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Link as RouterLink } from 'react-router-dom';

interface TeamInfo {
    id: number;
    name: string;
    prestige: number;
    rating: number;
    offense: number;
    defense: number;
    mascot: string;
    colorPrimary: string;
    confWins: number;
    confLosses: number;
    totalWins: number;
    totalLosses: number;
    ranking: number;
    conference: {
        id: number;
        confName: string;
    } | null;
}

interface TeamInfoModalProps {
    teamName: string;
    open: boolean;
    onClose: () => void;
}

export default function TeamInfoModal({ teamName, open, onClose }: TeamInfoModalProps) {
    const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamInfo = async () => {
            try {
                const encodedTeamName = encodeURIComponent(teamName);
                const response = await axios.get(`${API_BASE_URL}/api/team_info?team_name=${encodedTeamName}`);
                setTeamInfo(response.data.team);
            } catch (error) {
                console.error('Error fetching team info:', error);
            } finally {
                setLoading(false);
            }
        };

        if (open) {
            fetchTeamInfo();
        }
    }, [teamName, open]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="team-info-modal"
        >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                bgcolor: 'background.paper',
                boxShadow: 24,
                p: 4,
                borderRadius: 2,
                border: 3,
                borderColor: teamInfo?.colorPrimary || 'grey.500',
            }}>
                {loading ? (
                    <Typography>Loading...</Typography>
                ) : teamInfo ? (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Box
                                component="img"
                                src={`/logos/teams/${teamInfo.name}.png`}
                                sx={{ width: 50, height: 50 }}
                                alt={teamInfo.name}
                            />
                            <Typography variant="h5" component="h2">
                                #{teamInfo.ranking} {teamInfo.name} {teamInfo.mascot}
                            </Typography>
                            {teamInfo.conference && (
                                <Box
                                    component="img"
                                    src={`/logos/conferences/${teamInfo.conference.confName}.png`}
                                    sx={{ width: 30, height: 30 }}
                                    alt={teamInfo.conference.confName}
                                />
                            )}
                        </Box>
                        <Box sx={{ mt: 2 }}>
                            <Typography>Rating: {teamInfo.rating}</Typography>
                            <Typography>Prestige: {teamInfo.prestige}</Typography>
                            <Typography>
                                Record: {teamInfo.totalWins}-{teamInfo.totalLosses}
                                {teamInfo.conference && ` (${teamInfo.confWins}-${teamInfo.confLosses})`}
                            </Typography>
                        </Box>
                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                            <Link component={RouterLink} to={`/${teamInfo.name}/schedule`}>
                                View Schedule
                            </Link>
                            <Link component={RouterLink} to={`/${teamInfo.name}/roster`}>
                                View Roster
                            </Link>
                        </Box>
                    </>
                ) : (
                    <Typography color="error">Failed to load team information</Typography>
                )}
            </Box>
        </Modal>
    );
}