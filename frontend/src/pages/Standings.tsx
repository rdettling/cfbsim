import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { TeamInfoModal } from '../components/TeamComponents';
import { TeamLink, TeamLogo } from '../components/TeamComponents';
import { InlineLastWeek, InlineThisWeek } from '../components/InlineGameComponents';
import {
    Typography, TableContainer, Table,
    TableHead, TableBody, TableRow, TableCell,
    Paper, Box
} from '@mui/material';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface StandingsData {
    info: Info;
    team: Team;
    conference?: string;
    teams: Team[];
    conferences: Conference[];
}

const StandingsTable = ({ data, conference_name, onTeamClick }: {
    data: StandingsData,
    conference_name: string | undefined,
    onTeamClick: (name: string) => void
}) => (
    <TableContainer 
        component={Paper} 
        sx={{ 
            borderRadius: 3, 
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            minWidth: 1000
        }}
    >
        <Table sx={{ minWidth: 1000 }}>
            <TableHead>
                <TableRow sx={{ backgroundColor: 'primary.main' }}>
                    <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        width: '80px',
                        textAlign: 'center'
                    }}>
                        Rank
                    </TableCell>
                    <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        minWidth: '250px'
                    }}>
                        Team
                    </TableCell>
                    {conference_name !== 'independent' && (
                        <TableCell sx={{ 
                            color: 'white', 
                            fontWeight: 'bold', 
                            fontSize: '1rem',
                            width: '100px',
                            textAlign: 'center'
                        }}>
                            Conf
                        </TableCell>
                    )}
                    <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        width: '100px',
                        textAlign: 'center'
                    }}>
                        Overall
                    </TableCell>
                    <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}>
                        Last Week
                    </TableCell>
                    <TableCell sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}>
                        This Week
                    </TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {data.teams.map((team, index) => (
                    <TableRow 
                        key={team.name}
                        sx={{ 
                            backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                            '&:hover': { 
                                backgroundColor: 'grey.100',
                                transition: 'background-color 0.2s ease'
                            },
                            height: '72px'
                        }}
                    >
                        <TableCell sx={{ 
                            width: '80px',
                            textAlign: 'center',
                            py: 2
                        }}>
                            <Typography 
                                variant="h6" 
                                sx={{ 
                                    fontWeight: 'bold',
                                    color: index < 3 ? 'primary.main' : 'text.primary'
                                }}
                            >
                                {index + 1}
                            </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: '250px', py: 2 }}>
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 2
                            }}>
                                <TeamLogo name={team.name} size={40} />
                                <Box>
                                    <TeamLink name={team.name} onTeamClick={onTeamClick} />
                                    <Typography 
                                        variant="caption" 
                                        sx={{ 
                                            display: 'block',
                                            color: 'text.secondary',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        {team.confName}
                                    </Typography>
                                </Box>
                            </Box>
                        </TableCell>
                        {conference_name !== 'independent' && (
                            <TableCell sx={{ 
                                width: '100px',
                                textAlign: 'center',
                                py: 2
                            }}>
                                <Typography 
                                    variant="body1" 
                                    sx={{ fontWeight: 'medium' }}
                                >
                                    {team.confWins}-{team.confLosses}
                                </Typography>
                            </TableCell>
                        )}
                        <TableCell sx={{ 
                            width: '100px',
                            textAlign: 'center',
                            py: 2
                        }}>
                            <Typography 
                                variant="body1" 
                                sx={{ fontWeight: 'medium' }}
                            >
                                {team.totalWins}-{team.totalLosses}
                            </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: '200px', py: 2 }}>
                            <InlineLastWeek team={team} onTeamClick={onTeamClick} />
                        </TableCell>
                        <TableCell sx={{ minWidth: '200px', py: 2 }}>
                            <InlineThisWeek team={team} onTeamClick={onTeamClick} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

const Standings = () => {
    const { conference_name } = useParams();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            if (!conference_name) throw new Error('No conference specified');
            return apiService.getConferenceStandings<StandingsData>(conference_name);
        },
        dependencies: [conference_name],
        autoRefreshOnGameChange: true
    });

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences
            } : undefined}
            containerMaxWidth="lg"
        >
            {data && (
                <>
                    <Box sx={{ 
                        textAlign: 'center', 
                        mb: 5,
                        py: 4,
                        background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)',
                        borderRadius: 3,
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                    {/* Background decoration */}
                    <Box sx={{
                        position: 'absolute',
                        top: -50,
                        right: -50,
                        width: 200,
                        height: 200,
                        background: 'linear-gradient(45deg, rgba(25, 118, 210, 0.1), rgba(25, 118, 210, 0.05))',
                        borderRadius: '50%',
                        zIndex: 0
                    }} />
                    <Box sx={{
                        position: 'absolute',
                        bottom: -30,
                        left: -30,
                        width: 150,
                        height: 150,
                        background: 'linear-gradient(45deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.03))',
                        borderRadius: '50%',
                        zIndex: 0
                    }} />
                    
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        {conference_name !== 'independent' && (
                            <Box 
                                component="img" 
                                src={`/logos/conferences/${data.conference}.png`}
                                sx={{ 
                                    height: 120, 
                                    mb: 3,
                                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
                                    transition: 'transform 0.3s ease',
                                    '&:hover': {
                                        transform: 'scale(1.05)'
                                    }
                                }} 
                                alt={data.conference} 
                            />
                        )}
                        <Typography 
                            variant="h2" 
                            sx={{ 
                                fontWeight: 700,
                                background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 1,
                                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' }
                            }}
                        >
                            {conference_name === 'independent' ? 'Independent Teams' : `${data.conference} Standings`}
                        </Typography>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                color: 'text.secondary',
                                fontWeight: 400,
                                fontSize: '1.1rem'
                            }}
                        >
                            Conference Rankings & Team Performance
                        </Typography>
                    </Box>
                </Box>
                    <StandingsTable
                        data={data}
                        conference_name={conference_name}
                        onTeamClick={handleTeamClick}
                    />
                    <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
                </>
            )}
        </PageLayout>
    );
};

export default Standings;
