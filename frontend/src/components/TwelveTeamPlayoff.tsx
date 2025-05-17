import { useState } from 'react';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Box,
    Grid,
    Paper,
    List,
    ListItem,
    Chip,
} from '@mui/material';
import { TeamInfoModal } from './TeamComponents';

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

interface TwelveTeamPlayoffProps {
    playoffTeams: PlayoffTeam[];
    bubbleTeams: BubbleTeam[];
    conferenceChampions: ConferenceChampion[];
}

const TwelveTeamPlayoff = ({ playoffTeams, bubbleTeams, conferenceChampions }: TwelveTeamPlayoffProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam] = useState<string>('');

    return (
        <Container>
            <Typography variant="h2" align="center" sx={{ mb: 4 }}>
                12-Team Playoff Projection
            </Typography>

            <Grid container spacing={4}>
                {/* First Round */}
                <Grid item xs={3}>
                    <Typography variant="h5" gutterBottom>First Round</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[
                            [4, 11], [5, 10], [6, 9], [7, 8]
                        ].map(([higher, lower], idx) => (
                            <Paper key={`first-${idx}`} sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        #{higher + 1} {playoffTeams[higher]?.name}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        #{lower + 1} {playoffTeams[lower]?.name}
                                    </Box>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Grid>

                {/* Quarterfinals */}
                <Grid item xs={3}>
                    <Typography variant="h5" gutterBottom>Quarterfinals</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[3, 2, 1, 0].map((seed, idx) => (
                            <Paper key={`quarter-${idx}`} sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        #{seed + 1} {playoffTeams[seed]?.name}
                                    </Box>
                                    <Box>Winner of Previous</Box>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Grid>

                {/* Semifinals */}
                <Grid item xs={3}>
                    <Typography variant="h5" gutterBottom>Semifinals</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[0, 1].map((_, idx) => (
                            <Paper key={`semi-${idx}`} sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box>TBD</Box>
                                    <Box>TBD</Box>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Grid>

                {/* Final */}
                <Grid item xs={3}>
                    <Typography variant="h5" gutterBottom>Final</Typography>
                    <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box>TBD</Box>
                            <Box>TBD</Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Additional Information */}
            <Grid container spacing={4} sx={{ mt: 4 }}>
                {/* Bubble Teams */}
                <Grid item xs={6}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h5" gutterBottom>Bubble Teams</Typography>
                        <List>
                            {bubbleTeams.map((team) => (
                                <ListItem key={team.name}>
                                    #{team.ranking} {team.name} ({team.conference}) 
                                    - {team.record}
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>

                {/* Conference Champions */}
                <Grid item xs={6}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h5" gutterBottom>Conference Champions</Typography>
                        <List>
                            {conferenceChampions.map((team) => (
                                <ListItem key={team.name}>
                                    #{team.ranking} {team.name} ({team.conference}) 
                                    - {team.record}
                                    {team.seed && (
                                        <Chip 
                                            label={team.seed <= 4 
                                                ? `Playoff Seed #${team.seed}` 
                                                : 'Playoff Team'
                                            }
                                            color={team.seed <= 4 ? 'primary' : 'success'}
                                            size="small"
                                            sx={{ ml: 1 }}
                                        />
                                    )}
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>

            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </Container>
    );
};

export default TwelveTeamPlayoff; 