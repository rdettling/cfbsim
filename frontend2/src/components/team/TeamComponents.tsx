import { Box, Link as MuiLink, Modal, Typography, Paper, Chip, Button, Stack, Divider } from '@mui/material';
import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getTeamInfo } from '../../domain/league';

interface TeamLinkProps {
    name: string;
    onTeamClick: (name: string) => void;
}

interface LogoProps {
    name: string;
    size?: number;
}

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
    conference: string;
}

interface TeamInfoModalProps {
    teamName: string;
    open: boolean;
    onClose: () => void;
}

const getBasePath = () => {
    const base = import.meta.env.BASE_URL ?? '/';
    return base.endsWith('/') ? base.slice(0, -1) : base;
};

const Logo = ({ type, name, size = 30 }: LogoProps & { type: 'teams' | 'conferences' }) => {
    const [hasError, setHasError] = useState(false);
    const logoPath = `${getBasePath()}/logos/${type}/${name}.png`;

    return (
        <Box
            component="img"
            src={logoPath}
            onError={() => {
                console.error(`Failed to load ${type} logo for ${name} from ${logoPath}`);
                setHasError(true);
            }}
            sx={{
                width: 'auto', height: size, maxWidth: size * 2,
                border: hasError ? '1px dashed red' : 'none'
            }}
            alt={`${name} logo`}
        />
    );
};

export const TeamLogo = (props: LogoProps) => <Logo type="teams" {...props} />;
export const ConfLogo = (props: LogoProps) => <Logo type="conferences" {...props} />;

export const TeamLink = ({ name, onTeamClick }: TeamLinkProps) => (
    <MuiLink
        component="button"
        onClick={() => onTeamClick(name)}
        sx={{ cursor: 'pointer' }}
    >
        {name}
    </MuiLink>
);

// Stat item component to reduce repetition
const StatItem = ({ label, value }: { label: string, value: string | number }) => (
    <Box width="50%">
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h6">{value}</Typography>
    </Box>
);

// Action button component to reduce repetition
const ActionButton = ({ to, icon, label, color }: { to: string, icon: string, label: string, color: string }) => (
    <Button 
        component={RouterLink} 
        to={to}
        variant="outlined"
        size="small"
        startIcon={<Box>{icon}</Box>}
        sx={{ borderColor: color, color }}
    >
        {label}
    </Button>
);

export const TeamInfoModal = ({ teamName, open, onClose }: TeamInfoModalProps) => {
    const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!open || !teamName) return;

        setLoading(true);
        getTeamInfo(teamName)
            .then(team => team && setTeamInfo(team as TeamInfo))
            .catch(error => console.error('Error fetching team info:', error))
            .finally(() => setLoading(false));
    }, [teamName, open]);

    if (!open) return null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="team-info-modal"
        >
            <Paper
                elevation={24}
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: { xs: '90%', sm: 450 },
                    maxWidth: 500,
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    overflow: 'hidden',
                }}
            >
                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography>Loading team information...</Typography>
                    </Box>
                ) : teamInfo ? (
                    <>
                        {/* Header with team colors */}
                        <Box 
                            sx={{ 
                                bgcolor: teamInfo.colorPrimary || 'primary.main',
                                color: 'white',
                                p: 2,
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center">
                                <TeamLogo name={teamInfo.name} size={60} />
                                <Box>
                                    <Typography variant="h5" fontWeight="bold">
                                        {teamInfo.name} {teamInfo.mascot}
                                    </Typography>
                                    <Typography variant="subtitle1">{teamInfo.conference}</Typography>
                                </Box>
                            </Stack>
                            {teamInfo.ranking > 0 && (
                                <Chip 
                                    label={`#${teamInfo.ranking}`} 
                                    sx={{ 
                                        fontWeight: 'bold',
                                        bgcolor: 'white',
                                        color: teamInfo.colorPrimary || 'primary.main'
                                    }} 
                                />
                            )}
                        </Box>

                        {/* Team information */}
                        <Box sx={{ p: 3 }}>
                            {/* Stats in flexbox layout */}
                            <Stack 
                                direction="row" 
                                flexWrap="wrap" 
                                justifyContent="space-between"
                            >
                                <StatItem label="Rating" value={teamInfo.rating} />
                                <StatItem label="Prestige" value={teamInfo.prestige} />
                                <StatItem label="Overall Record" value={`${teamInfo.totalWins}-${teamInfo.totalLosses}`} />
                                {teamInfo.conference && (
                                    <StatItem 
                                        label="Conference Record" 
                                        value={`${teamInfo.confWins}-${teamInfo.confLosses}`} 
                                    />
                                )}
                            </Stack>

                            <Divider sx={{ my: 2 }} />

                            {/* Action buttons */}
                            <Stack 
                                direction="row" 
                                spacing={1} 
                                justifyContent="center"
                                flexWrap="wrap"
                            >
                                <ActionButton 
                                    to={`/${teamInfo.name}/schedule`} 
                                    icon="📅" 
                                    label="Schedule" 
                                    color={teamInfo.colorPrimary || "primary.main"} 
                                />
                                <ActionButton 
                                    to={`/${teamInfo.name}/roster`} 
                                    icon="👥" 
                                    label="Roster" 
                                    color={teamInfo.colorPrimary || "primary.main"} 
                                />
                                <ActionButton 
                                    to={`/${teamInfo.name}/history`} 
                                    icon="📜" 
                                    label="History" 
                                    color={teamInfo.colorPrimary || "primary.main"} 
                                />
                            </Stack>
                        </Box>
                    </>
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="error">Failed to load team information</Typography>
                    </Box>
                )}
            </Paper>
        </Modal>
    );
};
